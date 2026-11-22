import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  Controller,
  Get,
  Headers,
  Inject,
  type INestApplication,
  Logger,
  Param,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ContentClient } from '../../src/content/content-client';
import { InMemoryPinner } from '../../src/ipfs/in-memory-pinner';
import { IpfsError, PINNER, type Pinner } from '../../src/ipfs/pinner';
import { ContentSnapshotClient } from '../../src/metadata/content-snapshot-client';
import { MetadataModule } from '../../src/metadata/metadata.module';
import {
  METADATA_PUBLISHER,
  type MetadataPublisher,
  type PreparedMetadata,
} from '../../src/metadata/metadata-publisher.port';

const TOKEN = 'nft-to-content-test';
const IMAGE_ITEM = '3f2b8c1e-6a4d-4f7b-9c2e-1a2b3c4d5e6f';
const VIDEO_ITEM = '4a3b2c1d-0e9f-4a8b-8c7d-6e5f4a3b2c1d';
const EMPTY_ITEM = '5b4c3d2e-1f0a-4b9c-8d8e-7f6a5b4c3d2e';
const TAMPERED_ITEM = '6c5d4e3f-2a1b-4c0d-9e9f-8a7b6c5d4e3f';
const DRAFT_ITEM = '0c9d8e7f-1a2b-4c3d-8e4f-5a6b7c8d9e0f';
const IMAGE_ID = '11111111-1111-4111-8111-111111111111';
const SECOND_IMAGE_ID = '22222222-2222-4222-8222-222222222222';
const VIDEO_ID = '33333333-3333-4333-8333-333333333333';

const IMAGE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
const SECOND_IMAGE = Buffer.from([0xff, 0xd8, 0xff, 9, 9]);
const VIDEO = Buffer.from('....ftypisom-video-bytes');
const sha256 = (bytes: Buffer): string =>
  createHash('sha256').update(bytes).digest('hex');

interface FakeMedia {
  readonly id: string;
  readonly kind: 'image' | 'video';
  readonly mimeType: string;
  readonly bytes: Buffer;
  /** What Content claims; differs from the bytes for a tampered file. */
  readonly recorded: string;
}

function media(
  id: string,
  kind: 'image' | 'video',
  mimeType: string,
  bytes: Buffer,
  recorded = sha256(bytes),
): FakeMedia {
  return { id, kind, mimeType, bytes, recorded };
}

const ITEMS: Record<string, { status: string; media: FakeMedia[] }> = {
  [IMAGE_ITEM]: {
    status: 'published',
    media: [
      media(VIDEO_ID, 'video', 'video/mp4', VIDEO),
      media(IMAGE_ID, 'image', 'image/png', IMAGE),
      media(SECOND_IMAGE_ID, 'image', 'image/jpeg', SECOND_IMAGE),
    ],
  },
  [VIDEO_ITEM]: {
    status: 'published',
    media: [media(VIDEO_ID, 'video', 'video/mp4', VIDEO)],
  },
  [EMPTY_ITEM]: { status: 'published', media: [] },
  [TAMPERED_ITEM]: {
    status: 'published',
    media: [media(IMAGE_ID, 'image', 'image/png', IMAGE, 'f'.repeat(64))],
  },
  [DRAFT_ITEM]: { status: 'draft', media: [] },
};

function detail(id: string, item: { status: string; media: FakeMedia[] }) {
  return {
    id,
    title: 'Sobika voatenona',
    kind: 'object',
    creatorName: 'Rakoto',
    origin: 'Ambositra',
    period: null,
    thumbnailUrl: null,
    publicationStatus: item.status,
    submissionStatus: 'accepted',
    claims: { item: 'verified', description: 'unreviewed' },
    updatedAt: '2026-11-22T10:00:00.000Z',
    description: 'Woven basket.',
    creator: { name: 'Rakoto', community: 'Zafimaniry', technique: null },
    rights: { statement: 'PRIVATE-RIGHTS', confirmed: true },
    media: item.media.map((file) => ({
      id: file.id,
      kind: file.kind,
      mimeType: file.mimeType,
      bytes: file.bytes.length,
      url: `/api/items/${id}/media/${file.id}`,
      caption: 'PRIVATE-CAPTION',
    })),
    reviews: [],
    isOwner: false,
    createdAt: '2026-11-20T10:00:00.000Z',
    publishedAt: '2026-11-22T10:00:00.000Z',
  };
}

/** Fake Content: publication lookup, item detail and media, guest rules. */
function fakeContent(calls: string[]): Server {
  return createServer((req, res) => {
    const url = req.url ?? '';
    calls.push(url);
    const json = (status: number, body: unknown): void => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (
      req.headers['x-service-token'] !== TOKEN ||
      req.headers['x-service-name'] !== 'nft'
    ) {
      json(401, { code: 'SERVICE_UNAUTHENTICATED' });
      return;
    }
    if (req.headers['x-caller-user-id'] !== undefined) {
      json(400, { code: 'UNEXPECTED_USER' });
      return;
    }
    const match =
      /^\/internal\/v1\/items\/([^/]+)(?:\/(publication)|\/media\/([^/]+))?$/.exec(
        url,
      );
    // Content's UUID lookup is case-insensitive.
    const id = (match?.[1] ?? '').toLowerCase();
    const item = ITEMS[id];
    if (item === undefined) {
      json(404, { code: 'NOT_FOUND' });
      return;
    }
    if (match?.[2] === 'publication') {
      json(200, { contentId: id, publicationStatus: item.status });
      return;
    }
    // A guest only reads published items and their media.
    if (item.status !== 'published') {
      json(404, { code: 'NOT_FOUND' });
      return;
    }
    const mediaId = match?.[3];
    if (mediaId === undefined) {
      json(200, detail(id, item));
      return;
    }
    const file = item.media.find((candidate) => candidate.id === mediaId);
    if (file === undefined) {
      json(404, { code: 'MEDIA_NOT_FOUND' });
      return;
    }
    res.writeHead(200, {
      'content-type': file.mimeType,
      'content-length': String(file.bytes.length),
      etag: `"${file.recorded}"`,
    });
    res.end(file.bytes);
  });
}

/** Test-only route standing in for the mint flow (NFT-04). */
@Controller('test/metadata')
class ProbeController {
  constructor(
    @Inject(METADATA_PUBLISHER) private readonly publisher: MetadataPublisher,
  ) {}

  @Get(':id')
  prepare(
    @Param('id') id: string,
    @Headers('x-request-id') requestId: string,
  ): Promise<PreparedMetadata> {
    return this.publisher.prepare(id, { requestId });
  }
}

describe('NFT-03 metadata publisher (fake Content + fake pinner)', () => {
  let content: Server;
  let calls: string[];
  let app: INestApplication<Server>;
  let pinner: InMemoryPinner;

  async function boot(pinnerOverride?: Pinner): Promise<void> {
    const baseUrl = `http://127.0.0.1:${String((content.address() as AddressInfo).port)}`;
    pinner = new InMemoryPinner();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, MetadataModule],
      controllers: [ProbeController],
    })
      .overrideProvider(ContentClient)
      .useValue(new ContentClient({ baseUrl, token: TOKEN, timeoutMs: 1000 }))
      .overrideProvider(ContentSnapshotClient)
      .useValue(
        new ContentSnapshotClient({
          baseUrl,
          token: TOKEN,
          timeoutMs: 1000,
          mediaTimeoutMs: 1000,
        }),
      )
      .overrideProvider(PINNER)
      .useValue(pinnerOverride ?? pinner)
      .compile();
    app = moduleRef.createNestApplication<INestApplication<Server>>({
      logger: false,
    });
    await app.init();
  }

  function prepare(id: string, requestId = 'req-1') {
    return request(app.getHttpServer())
      .get(`/test/metadata/${id}`)
      .set('x-request-id', requestId);
  }

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    calls = [];
    content = fakeContent(calls);
    await new Promise<void>((resolve) => {
      content.listen(0, '127.0.0.1', resolve);
    });
  });

  beforeEach(() => {
    calls.length = 0;
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await new Promise<void>((resolve) => {
      content.close(() => {
        resolve();
      });
    });
  });

  it('provides METADATA_PUBLISHER from the application module', async () => {
    await boot();
    expect(app.get(METADATA_PUBLISHER)).toBeDefined();
  });

  it('pins the first image and the metadata, and returns the mint inputs', async () => {
    await boot();

    const response = await prepare(IMAGE_ITEM);

    expect(response.status).toBe(200);
    const prepared = response.body as PreparedMetadata;
    expect(prepared).toEqual({
      contentId: IMAGE_ITEM,
      tokenUri: `ipfs://${prepared.metadataCid}`,
      metadataCid: expect.stringMatching(/^bafkrei/) as unknown,
      imageCid: expect.stringMatching(/^bafkrei/) as unknown,
      masterHash: `0x${sha256(IMAGE)}`,
      title: 'Sobika voatenona',
      category: 'Craft',
    });
    expect(calls).toEqual([
      `/internal/v1/items/${IMAGE_ITEM}/publication`,
      `/internal/v1/items/${IMAGE_ITEM}`,
      `/internal/v1/items/${IMAGE_ITEM}/media/${IMAGE_ID}`,
    ]);

    const preview = pinner.get(prepared.imageCid ?? '');
    expect(Buffer.from(preview?.bytes ?? [])).toEqual(IMAGE);
    expect(preview?.name).toBe(`lova-${IMAGE_ITEM}-preview`);
    const pinned = pinner.get(prepared.metadataCid);
    expect(pinned?.name).toBe(`lova-${IMAGE_ITEM}-metadata.json`);
    const metadata = JSON.parse(
      new TextDecoder().decode(pinned?.bytes),
    ) as Record<string, unknown>;
    expect(metadata).toMatchObject({
      name: 'Sobika voatenona',
      image: `ipfs://${String(prepared.imageCid)}`,
      properties: {
        contentId: IMAGE_ITEM,
        master_sha256: prepared.masterHash,
      },
    });
    expect(JSON.stringify(metadata)).not.toContain('PRIVATE');
  });

  it('is idempotent for the same snapshot', async () => {
    await boot();

    const first = await prepare(IMAGE_ITEM);
    const second = await prepare(IMAGE_ITEM, 'req-2');

    expect(second.body).toEqual(first.body);
    expect(pinner.size).toBe(2);
  });

  it('accepts an upper-case ContentId and links the lower-case one', async () => {
    await boot();

    const response = await prepare(IMAGE_ITEM.toUpperCase());

    expect((response.body as PreparedMetadata).contentId).toBe(IMAGE_ITEM);
  });

  it('hashes a video master without a preview when there is no image', async () => {
    await boot();

    const response = await prepare(VIDEO_ITEM);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      imageCid: null,
      masterHash: `0x${sha256(VIDEO)}`,
    });
    expect(pinner.size).toBe(1);
  });

  it.each([
    [DRAFT_ITEM, 409, 'CONTENT_NOT_PUBLISHED'],
    ['7d6c5b4a-3e2f-4a1b-9c8d-7e6f5a4b3c2d', 404, 'CONTENT_NOT_FOUND'],
    ['not-a-uuid', 400, 'VALIDATION_FAILED'],
    [EMPTY_ITEM, 422, 'CONTENT_NOT_MINTABLE'],
    [TAMPERED_ITEM, 502, 'MEDIA_INTEGRITY_FAILED'],
  ])('answers %s with %s %s and pins nothing', async (id, status, code) => {
    await boot();

    const response = await prepare(id, 'req-err');

    expect(response.status).toBe(status);
    expect(response.body).toMatchObject({ code, requestId: 'req-err' });
    expect(Object.keys(response.body as object).sort()).toEqual(
      expect.arrayContaining(['code', 'message', 'requestId']),
    );
    expect(pinner.size).toBe(0);
  });

  it('answers 503 IPFS_UNAVAILABLE when pinning fails', async () => {
    await boot({
      pin: () => Promise.reject(new IpfsError('timeout')),
    });

    const response = await prepare(IMAGE_ITEM, 'req-ipfs');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      code: 'IPFS_UNAVAILABLE',
      message: 'The public archive is unavailable, try again later',
      requestId: 'req-ipfs',
    });
  });
});
