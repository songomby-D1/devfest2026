import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  Controller,
  Get,
  Headers,
  type INestApplication,
  Logger,
  Param,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ContentClient } from '../../src/content/content-client';
import { ContentModule } from '../../src/content/content.module';
import {
  ContentReferenceService,
  type PublishedContent,
} from '../../src/content/content-reference.service';

const PUBLISHED = '3f2b8c1e-6a4d-4f7b-9c2e-1a2b3c4d5e6f';
const DRAFT = '0c9d8e7f-1a2b-4c3d-8e4f-5a6b7c8d9e0f';
const TOKEN = 'nft-to-content-test';

/** Test-only route standing in for the future mint flow (NFT-04). */
@Controller('test/content')
class ProbeController {
  constructor(private readonly references: ContentReferenceService) {}

  @Get(':id')
  probe(
    @Param('id') id: string,
    @Headers('x-request-id') requestId: string | undefined,
  ): Promise<PublishedContent> {
    return this.references.assertPublished(id, { requestId });
  }
}

/** Fake Content: one published item, one draft, everything else 404. */
function fakeContent(): Server {
  return createServer((req, res) => {
    const match = /^\/internal\/v1\/items\/([^/]+)\/publication$/.exec(
      req.url ?? '',
    );
    if (req.headers['x-service-token'] !== TOKEN) {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ code: 'SERVICE_UNAUTHENTICATED' }));
      return;
    }
    const id = match?.[1];
    const status =
      id === PUBLISHED ? 'published' : id === DRAFT ? 'draft' : undefined;
    res.writeHead(status === undefined ? 404 : 200, {
      'content-type': 'application/json',
    });
    res.end(
      JSON.stringify(
        status === undefined
          ? { code: 'NOT_FOUND' }
          : { contentId: id, publicationStatus: status },
      ),
    );
  });
}

describe('NFT → Content publication check (HTTP)', () => {
  let content: Server;
  let app: INestApplication<Server>;

  async function boot(token: string): Promise<void> {
    const { port } = content.address() as AddressInfo;
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, ContentModule],
      controllers: [ProbeController],
    })
      .overrideProvider(ContentClient)
      .useValue(
        new ContentClient({
          baseUrl: `http://127.0.0.1:${String(port)}`,
          token,
          timeoutMs: 1000,
        }),
      )
      .compile();
    app = moduleRef.createNestApplication<INestApplication<Server>>({
      logger: false,
    });
    await app.init();
  }

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    content = fakeContent();
    await new Promise<void>((resolve) => {
      content.listen(0, '127.0.0.1', resolve);
    });
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

  it('wires the Content client from the validated configuration', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();

    expect(moduleRef.get(ContentClient)).toBeInstanceOf(ContentClient);
  });

  it('accepts a published item', async () => {
    await boot(TOKEN);

    const response = await request(app.getHttpServer())
      .get(`/test/content/${PUBLISHED}`)
      .set('x-request-id', 'req-1');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ contentId: PUBLISHED, requestId: 'req-1' });
  });

  it.each([
    [DRAFT, 409, 'CONTENT_NOT_PUBLISHED'],
    ['7d6c5b4a-3e2f-4a1b-9c8d-7e6f5a4b3c2d', 404, 'CONTENT_NOT_FOUND'],
    ['not-a-uuid', 400, 'VALIDATION_FAILED'],
  ])(
    'answers %s with %s %s in the public error shape',
    async (id, status, code) => {
      await boot(TOKEN);

      const response = await request(app.getHttpServer())
        .get(`/test/content/${id}`)
        .set('x-request-id', 'req-2');

      expect(response.status).toBe(status);
      expect(response.body).toMatchObject({ code, requestId: 'req-2' });
      expect(typeof (response.body as { message: unknown }).message).toBe(
        'string',
      );
    },
  );

  it('answers 503 CONTENT_UNAVAILABLE when Content refuses the secret', async () => {
    await boot('wrong-secret');

    const response = await request(app.getHttpServer())
      .get(`/test/content/${PUBLISHED}`)
      .set('x-request-id', 'req-3');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      code: 'CONTENT_UNAVAILABLE',
      message: 'The item service is unavailable, try again later',
      requestId: 'req-3',
    });
    expect(JSON.stringify(response.body)).not.toContain('wrong-secret');
  });
});
