import { Logger } from '@nestjs/common';
import request from 'supertest';
import type { MintRequestRecord } from '../../src/mint/mint-request';
import {
  ARTWORK,
  CONTENT_ID,
  CONTRACT,
  EXPLORER,
  METADATA_CID,
  mintRecord,
  TOKEN_URI,
  TX_HASH,
} from '../fixtures/provenance';
import { FakeContent } from '../support/fake-content';
import { InMemoryMintRepository } from '../support/in-memory-mint-repository';
import {
  createTestApp,
  gatewayHeaders,
  OWNER_ID,
  type TestApp,
} from '../support/test-app';

const DRAFT = '0c9d8e7f-1a2b-4c3d-8e4f-5a6b7c8d9e0f';
const UNKNOWN = '5b4a3c2d-1e0f-4a9b-8c7d-6e5f4a3b2c1d';

/** NFT-05 on the frozen `GET /internal/v1/provenance/{contentId}`. */
describe('Provenance display data (HTTP, fake chain and Content)', () => {
  const content = new FakeContent();
  let contentUrl: string;
  let repository: InMemoryMintRepository;
  let t: TestApp;

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    contentUrl = await content.start();
  });

  beforeEach(async () => {
    content.items.clear();
    content.failWith = undefined;
    content.items.set(CONTENT_ID, {
      ownerId: OWNER_ID,
      publicationStatus: 'published',
    });
    content.items.set(DRAFT, { ownerId: OWNER_ID, publicationStatus: 'draft' });
    repository = new InMemoryMintRepository();
    t = await createTestApp({ contentUrl, repository });
  });

  afterEach(async () => {
    await t.app.close();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await content.stop();
  });

  function provenance(contentId: string) {
    return request(t.app.getHttpServer())
      .get(`/internal/v1/provenance/${contentId}`)
      .set(gatewayHeaders(null));
  }

  function put(record: MintRequestRecord): void {
    repository.rows.set(record.id, record);
  }

  it('refuses a call without the gateway credentials', async () => {
    const response = await provenance(CONTENT_ID).set(
      'x-service-token',
      'nope',
    );
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: 'SERVICE_UNAUTHENTICATED' });
  });

  it('answers mint null with no-store for a published item without a mint', async () => {
    const response = await provenance(CONTENT_ID);
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({
      contentId: CONTENT_ID,
      mint: null,
      scope: expect.stringContaining('No certificate') as unknown,
    });
  });

  it('answers a verified confirmed mint with a short public cache', async () => {
    put(mintRecord());
    t.chain.artworks.set('7', { artwork: ARTWORK, tokenUri: TOKEN_URI });
    const response = await provenance(CONTENT_ID);
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=60');
    expect(response.body).toMatchObject({
      contentId: CONTENT_ID,
      mint: {
        status: 'confirmed',
        tokenId: '7',
        transactionHash: TX_HASH,
        explorerUrl: `${EXPLORER}/tx/${TX_HASH}`,
        network: { name: 'Avalanche Fuji', chainId: 43113 },
        explorer: {
          transaction: `${EXPLORER}/tx/${TX_HASH}`,
          token: `${EXPLORER}/nft/${CONTRACT}/7`,
        },
        tokenUri: TOKEN_URI,
        metadataUrl: `https://gateway.pinata.cloud/ipfs/${METADATA_CID}`,
        verification: {
          state: 'verified',
          fixity: true,
          onChain: { title: 'Lamba mena', category: 'Craft' },
        },
      },
    });
  });

  it('verifies a mint made through the whole journey', async () => {
    const started = await request(t.app.getHttpServer())
      .post('/internal/v1/mints')
      .set(gatewayHeaders(OWNER_ID, { 'idempotency-key': 'prov-key-00000001' }))
      .send({ contentId: CONTENT_ID });
    expect(started.status).toBe(202);
    await t.processor.whenIdle();

    const response = await provenance(CONTENT_ID);
    expect(response.body).toMatchObject({
      mint: {
        status: 'confirmed',
        tokenId: '1',
        verification: { state: 'verified', fixity: true },
      },
    });
  });

  it('still answers 200 when the RPC is down, unverifiable and briefly cached', async () => {
    put(mintRecord());
    t.chain.readsDown = true;
    const response = await provenance(CONTENT_ID);
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=15');
    expect(response.body).toMatchObject({
      mint: {
        status: 'confirmed',
        tokenId: '7',
        verification: { state: 'unverifiable', fixity: null, onChain: null },
      },
    });
  });

  it.each([
    ['pending', mintRecord({ status: 'pending', tokenId: null })],
    [
      'failed',
      mintRecord({ status: 'failed', failureCode: 'CHAIN_UNAVAILABLE' }),
    ],
  ])('answers a %s mint with no-store', async (status, record) => {
    put(record);
    const response = await provenance(CONTENT_ID);
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toMatchObject({ mint: { status } });
    expect(t.chain.reads).toBe(0);
  });

  it.each([
    ['a draft', DRAFT],
    ['an unknown item', UNKNOWN],
  ])('answers the same 404 for %s', async (_, id) => {
    put(mintRecord({ contentId: id }));
    const response = await provenance(id).set('x-request-id', 'req-404');
    expect(response.status).toBe(404);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({
      code: 'NOT_FOUND',
      message: 'The item does not exist',
      requestId: 'req-404',
    });
  });

  it('answers 503 in the public shape when Content is down', async () => {
    content.failWith = 503;
    const response = await provenance(CONTENT_ID);
    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      code: 'CONTENT_UNAVAILABLE',
      message: expect.any(String) as unknown,
      requestId: 'req-mint-1',
    });
  });

  it('answers 503 in the public shape when the mint records are down', async () => {
    jest
      .spyOn(repository, 'findLatestForContent')
      .mockRejectedValueOnce(new Error('database down'));
    const response = await provenance(CONTENT_ID);
    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      code: 'NFT_UNAVAILABLE',
      message: 'The provenance service is unavailable, try again later',
      requestId: 'req-mint-1',
    });
  });
});
