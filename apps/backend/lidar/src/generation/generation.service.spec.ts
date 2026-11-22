import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryObjectStorage } from '../../test/support/in-memory-object-storage.js';
import { PublicError } from '../common/public-error.js';
import { GenerationService } from './generation.service.js';
import {
  type ImageTo3dRequest,
  type MeshyClient,
  type MeshyDownload,
  MeshyError,
  type MeshyTask,
} from './meshy-client.js';

const OWNER = 'owner-1';
const OTHER = 'owner-2';
const PNG = `data:image/png;base64,${Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 1, 2, 3, 4,
]).toString('base64')}`;
const GLB = Buffer.concat([Buffer.from('glTF'), Buffer.alloc(16)]);

class FakeMeshy implements MeshyClient {
  created: ImageTo3dRequest[] = [];
  task: MeshyTask = {
    id: 'task-1',
    status: 'PENDING',
    progress: 0,
    glbUrl: null,
    thumbnailUrl: null,
    errorCode: null,
  };
  createError: MeshyError | null = null;
  polls = 0;
  model: Buffer = GLB;

  createImageTo3d(request: ImageTo3dRequest): Promise<string> {
    if (this.createError !== null) return Promise.reject(this.createError);
    this.created.push(request);
    return Promise.resolve('task-1');
  }

  getImageTo3d(): Promise<MeshyTask> {
    this.polls += 1;
    return Promise.resolve(this.task);
  }

  download(url: string): Promise<MeshyDownload> {
    return Promise.resolve({
      bytes: url.endsWith('.png') ? Buffer.from('png') : this.model,
      contentType: 'application/octet-stream',
    });
  }
}

async function publicErrorOf(promise: Promise<unknown>): Promise<PublicError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof PublicError) return error;
    throw error;
  }
  throw new Error('Expected a PublicError');
}

/** Lets the background store() run to completion. */
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

describe('GenerationService', () => {
  let meshy: FakeMeshy;
  let storage: InMemoryObjectStorage;
  let now: number;
  let service: GenerationService;

  beforeEach(() => {
    meshy = new FakeMeshy();
    storage = new InMemoryObjectStorage();
    now = 1_000_000;
    service = new GenerationService(meshy, storage, () => now);
  });

  it('starts an image-to-3D task and reports it queued', async () => {
    const view = await service.create(OWNER, {
      image: PNG,
      title: 'Sobika',
      texturePrompt: 'raffia',
    });
    expect(meshy.created).toEqual([
      { imageDataUri: PNG, texturePrompt: 'raffia' },
    ]);
    expect(view).toMatchObject({
      title: 'Sobika',
      status: 'queued',
      progress: 0,
      modelUrl: null,
      errorCode: null,
    });
  });

  it('refuses a data URI whose bytes are not the declared image type', async () => {
    const fake = `data:image/png;base64,${Buffer.from('not an image at all').toString('base64')}`;
    const error = await publicErrorOf(service.create(OWNER, { image: fake }));
    expect(error.code).toBe('IMAGE_INVALID');
    expect(meshy.created).toHaveLength(0);
  });

  it('limits a visitor to two running generations', async () => {
    await service.create(OWNER, { image: PNG });
    await service.create(OWNER, { image: PNG });
    const error = await publicErrorOf(service.create(OWNER, { image: PNG }));
    expect(error.code).toBe('GENERATION_LIMIT_REACHED');
    await expect(service.create(OTHER, { image: PNG })).resolves.toBeDefined();
  });

  it.each([
    ['credits', 'GENERATION_CREDITS_EXHAUSTED', 402],
    ['busy', 'GENERATION_BUSY', 429],
    ['rejected', 'GENERATION_REJECTED', 422],
    ['unavailable', 'GENERATION_UNAVAILABLE', 503],
  ] as const)(
    'maps a Meshy %s failure to %s',
    async (failure, code, status) => {
      meshy.createError = new MeshyError(failure, 0);
      const error = await publicErrorOf(service.create(OWNER, { image: PNG }));
      expect(error.code).toBe(code);
      expect(error.getStatus()).toBe(status);
    },
  );

  it('hides another visitor’s generation', async () => {
    const { id } = await service.create(OWNER, { image: PNG });
    const error = await publicErrorOf(service.get(OTHER, id));
    expect(error.code).toBe('NOT_FOUND');
  });

  it('polls Meshy at most once per interval and scales its progress', async () => {
    const { id } = await service.create(OWNER, { image: PNG });
    meshy.task = { ...meshy.task, status: 'IN_PROGRESS', progress: 50 };
    await service.get(OWNER, id);
    expect(meshy.polls).toBe(0);

    now += 3000;
    const view = await service.get(OWNER, id);
    expect(meshy.polls).toBe(1);
    expect(view).toMatchObject({ status: 'modeling', progress: 48 });

    await service.get(OWNER, id);
    expect(meshy.polls).toBe(1);
  });

  it('stores the finished model and poster, then serves them to the owner only', async () => {
    const { id } = await service.create(OWNER, { image: PNG });
    meshy.task = {
      ...meshy.task,
      status: 'SUCCEEDED',
      progress: 100,
      glbUrl: 'https://assets.meshy.ai/x/model.glb',
      thumbnailUrl: 'https://assets.meshy.ai/x/preview.png',
    };
    now += 3000;
    expect((await service.get(OWNER, id)).status).toBe('storing');
    await settle();

    const view = await service.get(OWNER, id);
    expect(view).toMatchObject({
      status: 'ready',
      progress: 100,
      modelUrl: `/api/generations/${id}/model.glb`,
      posterUrl: `/api/generations/${id}/poster`,
    });
    const model = await service.readModel(OWNER, id);
    expect(model.object.size).toBe(GLB.length);
    expect(model.contentType).toBe('model/gltf-binary');
    await expect(service.readModel(OTHER, id)).rejects.toBeInstanceOf(
      PublicError,
    );
  });

  it('fails the generation when the download is not a GLB', async () => {
    meshy.model = Buffer.from('<html>error</html>');
    const { id } = await service.create(OWNER, { image: PNG });
    meshy.task = {
      ...meshy.task,
      status: 'SUCCEEDED',
      glbUrl: 'https://assets.meshy.ai/x/model.glb',
    };
    now += 3000;
    await service.get(OWNER, id);
    await settle();
    expect(await service.get(OWNER, id)).toMatchObject({
      status: 'failed',
      errorCode: 'GENERATION_FAILED',
      modelUrl: null,
    });
  });

  it('reports a moderated task as rejected', async () => {
    const { id } = await service.create(OWNER, { image: PNG });
    meshy.task = {
      ...meshy.task,
      status: 'FAILED',
      errorCode: 'moderation_blocked',
    };
    now += 3000;
    expect(await service.get(OWNER, id)).toMatchObject({
      status: 'failed',
      errorCode: 'GENERATION_REJECTED',
    });
  });

  it('keeps a generation running when one poll fails', async () => {
    const { id } = await service.create(OWNER, { image: PNG });
    meshy.getImageTo3d = () =>
      Promise.reject(new MeshyError('unavailable', 502));
    now += 3000;
    expect((await service.get(OWNER, id)).status).toBe('queued');
  });

  it('lists the owner’s generations, newest first', async () => {
    const first = await service.create(OWNER, { image: PNG, title: 'A' });
    now += 1;
    const second = await service.create(OWNER, { image: PNG, title: 'B' });
    await service.create(OTHER, { image: PNG });
    expect(service.list(OWNER).map((view) => view.id)).toEqual([
      second.id,
      first.id,
    ]);
  });
});
