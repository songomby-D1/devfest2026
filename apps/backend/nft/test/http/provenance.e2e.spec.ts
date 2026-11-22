import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { type INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ContentClient } from '../../src/content/content-client';
import {
  FakeChainProvenanceReader,
  InMemoryMintRecordReader,
} from '../../src/provenance/provenance.fakes';
import {
  CHAIN_PROVENANCE_READER,
  MINT_RECORD_READER,
} from '../../src/provenance/provenance.ports';
import { PROVENANCE_OPTIONS } from '../../src/provenance/provenance.service';
import {
  CONTENT_ID,
  chainToken,
  EXPLORER,
  IPFS_GATEWAY,
  METADATA_CID,
  mintRecord,
  TX_HASH,
} from '../fixtures/provenance';

const DRAFT = '0c9d8e7f-1a2b-4c3d-8e4f-5a6b7c8d9e0f';
const UNKNOWN = '5b4a3c2d-1e0f-4a9b-8c7d-6e5f4a3b2c1d';
const TOKEN = 'nft-to-content-test';

/** Fake Content: CONTENT_ID published, DRAFT a draft, everything else 404. */
function fakeContent(): Server {
  return createServer((req, res) => {
    const id = /^\/internal\/v1\/items\/([^/]+)\/publication$/.exec(
      req.url ?? '',
    )?.[1];
    const status =
      req.headers['x-service-token'] !== TOKEN
        ? 'unauthenticated'
        : id === CONTENT_ID
          ? 'published'
          : id === DRAFT
            ? 'draft'
            : undefined;
    if (status === 'unauthenticated') {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ code: 'SERVICE_UNAUTHENTICATED' }));
      return;
    }
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

describe('GET /internal/v1/items/:contentId/provenance (HTTP)', () => {
  let content: Server;
  let app: INestApplication<Server>;
  let mints: InMemoryMintRecordReader;
  let chain: FakeChainProvenanceReader;

  beforeAll(async () => {
    Logger.overrideLogger(false);
    content = fakeContent();
    await new Promise<void>((resolve) => {
      content.listen(0, '127.0.0.1', resolve);
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      content.close(() => {
        resolve();
      });
    });
  });

  beforeEach(async () => {
    mints = new InMemoryMintRecordReader();
    chain = new FakeChainProvenanceReader();
    const { port } = content.address() as AddressInfo;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ContentClient)
      .useValue(
        new ContentClient({
          baseUrl: `http://127.0.0.1:${String(port)}`,
          token: TOKEN,
          timeoutMs: 1000,
          retries: 0,
        }),
      )
      .overrideProvider(MINT_RECORD_READER)
      .useValue(mints)
      .overrideProvider(CHAIN_PROVENANCE_READER)
      .useValue(chain)
      .overrideProvider(PROVENANCE_OPTIONS)
      .useValue({
        explorerBaseUrl: EXPLORER,
        ipfsGatewayUrl: IPFS_GATEWAY,
        chainTimeoutMs: 100,
      })
      .compile();
    app = moduleRef.createNestApplication<INestApplication<Server>>({
      logger: false,
    });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const path = (id: string): string => `/internal/v1/items/${id}/provenance`;

  it('answers mint null with no-store for a published item without a mint', async () => {
    const response = await request(app.getHttpServer())
      .get(path(CONTENT_ID))
      .expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({
      contentId: CONTENT_ID,
      mint: null,
      scope: expect.stringContaining('No certificate') as unknown,
    });
  });

  it('answers a verified confirmed mint with a short public cache', async () => {
    mints.put(mintRecord());
    chain.put('7', chainToken());
    const response = await request(app.getHttpServer())
      .get(path(CONTENT_ID))
      .expect(200);
    expect(response.headers['cache-control']).toBe('public, max-age=60');
    expect(response.body).toMatchObject({
      contentId: CONTENT_ID,
      mint: {
        status: 'confirmed',
        tokenId: '7',
        transactionHash: TX_HASH,
        network: { name: 'Avalanche Fuji', chainId: 43113 },
        explorer: { transaction: `${EXPLORER}/tx/${TX_HASH}` },
        metadataUrl: `https://gateway.pinata.cloud/ipfs/${METADATA_CID}`,
        verification: { state: 'verified', fixity: true },
      },
    });
  });

  it('still answers 200 when the RPC is down, unverifiable and briefly cached', async () => {
    mints.put(mintRecord());
    chain.mode = 'unavailable';
    const response = await request(app.getHttpServer())
      .get(path(CONTENT_ID))
      .expect(200);
    expect(response.headers['cache-control']).toBe('public, max-age=15');
    expect(response.body).toMatchObject({
      mint: {
        status: 'confirmed',
        tokenId: '7',
        verification: { state: 'unverifiable', fixity: null },
      },
    });
  });

  it.each([
    ['pending', mintRecord({ status: 'pending', tokenId: null })],
    ['failed', mintRecord({ status: 'failed', failureCode: 'CHAIN_UNAVAILABLE' })],
  ])('answers a %s mint with no-store', async (status, record) => {
    mints.put(record);
    const response = await request(app.getHttpServer())
      .get(path(CONTENT_ID))
      .expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toMatchObject({ mint: { status } });
  });

  it.each([
    ['a draft', DRAFT],
    ['an unknown item', UNKNOWN],
  ])('answers the same 404 for %s', async (_, id) => {
    const response = await request(app.getHttpServer())
      .get(path(id))
      .set('x-request-id', 'req-404')
      .expect(404);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({
      code: 'NOT_FOUND',
      message: 'The item does not exist',
      requestId: 'req-404',
    });
  });

  it('answers 400 for a ContentId that is not a UUID', async () => {
    const response = await request(app.getHttpServer())
      .get(path('nope'))
      .expect(400);
    expect(response.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      requestId: expect.any(String) as unknown,
    });
  });

  it('answers 503 in the public shape when the mint records are down', async () => {
    mints.failure = new Error('database down');
    const response = await request(app.getHttpServer())
      .get(path(CONTENT_ID))
      .expect(503);
    expect(response.body).toEqual({
      code: 'NFT_UNAVAILABLE',
      message: 'The provenance service is unavailable, try again later',
      requestId: expect.any(String) as unknown,
    });
  });
});
