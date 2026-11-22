import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { PublicError } from '../common/public-error.js';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
  type StoredObject,
} from '../storage/object-storage.js';
import {
  type CreateGenerationDto,
  GENERATION_PUBLIC_BASE_PATH,
  type GenerationErrorCode,
  type GenerationStatus,
  type GenerationView,
  isAcceptedImage,
} from './generation.js';
import {
  MESHY_CLIENT,
  type MeshyClient,
  MeshyError,
  type MeshyTask,
} from './meshy-client.js';

export const GENERATION_CLOCK = Symbol('GENERATION_CLOCK');
export type Clock = () => number;

/** Meshy is polled at most this often per generation, however often the browser asks. */
const POLL_INTERVAL_MS = 2500;
const MAX_ACTIVE_PER_OWNER = 2;
const MAX_KEPT_PER_OWNER = 12;
const MAX_GLB_BYTES = 64 * 1024 * 1024;
const MAX_POSTER_BYTES = 4 * 1024 * 1024;
/** Meshy keeps API models for 3 days; a task still running after a day is abandoned. */
const MAX_TASK_AGE_MS = 24 * 60 * 60 * 1000;
/** The share of the progress bar given to storing the model in LiDAR. */
const MODELING_SHARE = 95;

const REJECTED_TASK_CODES = new Set([
  'invalid_input',
  'image_too_complex',
  'moderation_blocked',
]);

interface GenerationRecord {
  readonly id: string;
  readonly ownerId: string;
  readonly title: string;
  readonly taskId: string;
  readonly createdAt: number;
  status: GenerationStatus;
  progress: number;
  hasPoster: boolean;
  errorCode: GenerationErrorCode | null;
  lastPolledAt: number;
  refreshing: Promise<void> | null;
}

export interface StoredModel {
  readonly object: StoredObject;
  readonly body: Readable;
  readonly contentType: string;
}

/**
 * Image-to-3D generations through Meshy. A generation is owned by the visitor
 * who started it. Its record lives in memory (demo scope: lost on restart),
 * and the finished GLB is copied into LiDAR's object storage because Meshy
 * deletes API models after three days.
 */
@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);
  private readonly records = new Map<string, GenerationRecord>();

  constructor(
    @Inject(MESHY_CLIENT) private readonly meshy: MeshyClient,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(GENERATION_CLOCK) private readonly now: Clock,
  ) {}

  async create(
    ownerId: string,
    input: CreateGenerationDto,
  ): Promise<GenerationView> {
    if (!isAcceptedImage(input.image)) {
      throw new PublicError(
        'IMAGE_INVALID',
        'The image must be a JPEG, PNG or WebP file under 1.4 MB.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const owned = this.ownedBy(ownerId);
    if (
      owned.filter((record) => isActive(record.status)).length >=
      MAX_ACTIVE_PER_OWNER
    ) {
      throw new PublicError(
        'GENERATION_LIMIT_REACHED',
        'Wait for your current generations to finish before starting another.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    let taskId: string;
    try {
      taskId = await this.meshy.createImageTo3d({
        imageDataUri: input.image,
        texturePrompt: input.texturePrompt,
      });
    } catch (error) {
      throw toPublicError(error);
    }

    const now = this.now();
    const record: GenerationRecord = {
      id: randomUUID(),
      ownerId,
      title: input.title ?? 'Œuvre générée',
      taskId,
      createdAt: now,
      status: 'queued',
      progress: 0,
      hasPoster: false,
      errorCode: null,
      lastPolledAt: now,
      refreshing: null,
    };
    this.records.set(record.id, record);
    this.forgetOldest(ownerId);
    return toView(record);
  }

  async get(ownerId: string, id: string): Promise<GenerationView> {
    const record = this.find(ownerId, id);
    await this.refresh(record);
    return toView(record);
  }

  list(ownerId: string): GenerationView[] {
    return this.ownedBy(ownerId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(toView);
  }

  async readModel(ownerId: string, id: string): Promise<StoredModel> {
    return this.readStored(
      this.find(ownerId, id),
      'model.glb',
      'model/gltf-binary',
    );
  }

  async readPoster(ownerId: string, id: string): Promise<StoredModel> {
    const record = this.find(ownerId, id);
    if (!record.hasPoster) throw notFound();
    return this.readStored(record, 'poster', 'image/png');
  }

  private async readStored(
    record: GenerationRecord,
    name: string,
    fallbackType: string,
  ): Promise<StoredModel> {
    if (record.status !== 'ready') throw notFound();
    const key = objectKey(record.id, name);
    const object = await this.storage.stat(key);
    if (object === null) throw notFound();
    return {
      object,
      body: await this.storage.read(key),
      contentType: fallbackType,
    };
  }

  private find(ownerId: string, id: string): GenerationRecord {
    const record = this.records.get(id);
    // Another visitor's generation answers like a missing one.
    if (record?.ownerId !== ownerId) throw notFound();
    return record;
  }

  private ownedBy(ownerId: string): GenerationRecord[] {
    return [...this.records.values()].filter(
      (record) => record.ownerId === ownerId,
    );
  }

  /** Keeps the newest generations of an owner, dropping the oldest finished ones. */
  private forgetOldest(ownerId: string): void {
    const finished = this.ownedBy(ownerId)
      .filter((record) => !isActive(record.status))
      .sort((a, b) => a.createdAt - b.createdAt);
    let excess = this.ownedBy(ownerId).length - MAX_KEPT_PER_OWNER;
    for (const record of finished) {
      if (excess <= 0) break;
      this.records.delete(record.id);
      excess -= 1;
    }
  }

  private async refresh(record: GenerationRecord): Promise<void> {
    if (record.status !== 'queued' && record.status !== 'modeling') return;
    if (record.refreshing !== null) {
      await record.refreshing;
      return;
    }
    if (this.now() - record.lastPolledAt < POLL_INTERVAL_MS) {
      return;
    }
    record.refreshing = this.poll(record).finally(() => {
      record.refreshing = null;
    });
    await record.refreshing;
  }

  private async poll(record: GenerationRecord): Promise<void> {
    record.lastPolledAt = this.now();
    if (record.lastPolledAt - record.createdAt > MAX_TASK_AGE_MS) {
      this.fail(record, 'GENERATION_EXPIRED');
      return;
    }
    let task: MeshyTask;
    try {
      task = await this.meshy.getImageTo3d(record.taskId);
    } catch (error) {
      if (error instanceof MeshyError && error.failure === 'not_found') {
        this.fail(record, 'GENERATION_EXPIRED');
        return;
      }
      // A transient Meshy failure keeps the generation running; the next poll retries.
      this.logger.warn(
        `Meshy poll failed for generation ${record.id}: ${describe(error)}`,
      );
      return;
    }
    switch (task.status) {
      case 'PENDING':
        record.status = 'queued';
        record.progress = Math.max(record.progress, 1);
        return;
      case 'IN_PROGRESS':
        record.status = 'modeling';
        record.progress = Math.max(
          record.progress,
          Math.round((task.progress * MODELING_SHARE) / 100),
        );
        return;
      case 'FAILED':
      case 'CANCELED':
        this.fail(
          record,
          task.errorCode !== null && REJECTED_TASK_CODES.has(task.errorCode)
            ? 'GENERATION_REJECTED'
            : 'GENERATION_FAILED',
        );
        return;
      case 'SUCCEEDED':
        if (task.glbUrl === null) {
          this.fail(record, 'GENERATION_FAILED');
          return;
        }
        record.status = 'storing';
        record.progress = MODELING_SHARE;
        // Owned background work: store() records its own failure on the generation.
        void this.store(record, task.glbUrl, task.thumbnailUrl);
        return;
    }
  }

  private async store(
    record: GenerationRecord,
    glbUrl: string,
    thumbnailUrl: string | null,
  ): Promise<void> {
    try {
      const model = await this.meshy.download(glbUrl, MAX_GLB_BYTES);
      if (model.bytes.toString('latin1', 0, 4) !== 'glTF') {
        throw new Error('Downloaded model is not a GLB');
      }
      await this.storage.write(
        objectKey(record.id, 'model.glb'),
        Readable.from(model.bytes),
        {
          contentType: 'model/gltf-binary',
          contentLength: model.bytes.length,
        },
      );
      if (thumbnailUrl !== null) {
        record.hasPoster = await this.storePoster(record, thumbnailUrl);
      }
      record.status = 'ready';
      record.progress = 100;
    } catch (error) {
      this.logger.error(
        `Storing generation ${record.id} failed: ${describe(error)}`,
      );
      this.fail(record, 'GENERATION_FAILED');
    }
  }

  /** The poster is optional: a failure leaves the model usable. */
  private async storePoster(
    record: GenerationRecord,
    url: string,
  ): Promise<boolean> {
    try {
      const poster = await this.meshy.download(url, MAX_POSTER_BYTES);
      await this.storage.write(
        objectKey(record.id, 'poster'),
        Readable.from(poster.bytes),
        {
          contentType: 'image/png',
          contentLength: poster.bytes.length,
        },
      );
      return true;
    } catch (error) {
      this.logger.warn(
        `Poster of generation ${record.id} skipped: ${describe(error)}`,
      );
      return false;
    }
  }

  private fail(record: GenerationRecord, code: GenerationErrorCode): void {
    record.status = 'failed';
    record.errorCode = code;
  }
}

function isActive(status: GenerationStatus): boolean {
  return status === 'queued' || status === 'modeling' || status === 'storing';
}

function objectKey(id: string, name: string): string {
  return `generations/${id}/${name}`;
}

function toView(record: GenerationRecord): GenerationView {
  const base = `${GENERATION_PUBLIC_BASE_PATH}/${record.id}`;
  const ready = record.status === 'ready';
  return {
    id: record.id,
    title: record.title,
    status: record.status,
    progress: record.progress,
    modelUrl: ready ? `${base}/model.glb` : null,
    posterUrl: ready && record.hasPoster ? `${base}/poster` : null,
    errorCode: record.errorCode,
    createdAt: new Date(record.createdAt).toISOString(),
  };
}

function notFound(): PublicError {
  return new PublicError(
    'NOT_FOUND',
    'The generation was not found.',
    HttpStatus.NOT_FOUND,
  );
}

/** Only the error name and Meshy status are logged: messages could carry URLs. */
function describe(error: unknown): string {
  if (error instanceof MeshyError) {
    return `${error.failure} (HTTP ${String(error.status)})`;
  }
  return error instanceof Error ? error.name : 'unknown error';
}

function toPublicError(error: unknown): PublicError {
  if (!(error instanceof MeshyError)) {
    return new PublicError(
      'GENERATION_UNAVAILABLE',
      'The 3D generation service is unavailable.',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
  switch (error.failure) {
    case 'rejected':
      return new PublicError(
        'GENERATION_REJECTED',
        'The image was refused by the 3D generation service.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    case 'credits':
      return new PublicError(
        'GENERATION_CREDITS_EXHAUSTED',
        'The 3D generation quota is exhausted.',
        HttpStatus.PAYMENT_REQUIRED,
      );
    case 'busy':
      return new PublicError(
        'GENERATION_BUSY',
        'The 3D generation service is busy. Try again shortly.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    case 'not_found':
    case 'unavailable':
      return new PublicError(
        'GENERATION_UNAVAILABLE',
        'The 3D generation service is unavailable.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
  }
}
