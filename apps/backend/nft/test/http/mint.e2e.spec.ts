import { Logger } from '@nestjs/common';
import request from 'supertest';
import { ChainError } from '../../src/blockchain/blockchain.port';
import { MINT_FAILURES } from '../../src/mint/mint-failure';
import { NO_MINT_SCOPE, PROVENANCE_SCOPE } from '../../src/mint/mint-view';
import { FakeContent } from '../support/fake-content';
import { InMemoryMintRepository } from '../support/in-memory-mint-repository';
import {
  createTestApp,
  gatewayHeaders,
  OTHER_ID,
  OWNER_ID,
  type TestApp,
} from '../support/test-app';

const ITEM = '3f2b8c1e-6a4d-4f7b-9c2e-1a2b3c4d5e6f';
const OTHER_ITEM = '7d6c5b4a-3e2f-4a1b-9c8d-7e6f5a4b3c2d';
const DRAFT = '0c9d8e7f-1a2b-4c3d-8e4f-5a6b7c8d9e0f';
const KEY = 'mint-key-0000000001';

const MINT_KEYS = [
  'mintId',
  'contentId',
  'status',
  'network',
  'tokenId',
  'transactionHash',
  'explorerUrl',
  'failureReason',
  'requestedAt',
  'confirmedAt',
].sort();

interface MintBody {
  mintId: string;
  status: string;
  tokenId: string | null;
  transactionHash: string | null;
  failureReason: string | null;
  [key: string]: unknown;
}

describe('NFT mint journey (HTTP, fake chain and Content)', () => {
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
    content.requests.length = 0;
    content.failWith = undefined;
    content.items.set(ITEM, {
      ownerId: OWNER_ID,
      publicationStatus: 'published',
    });
    content.items.set(OTHER_ITEM, {
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

  const http = () => request(t.app.getHttpServer());

  function mint(
    contentId: string,
    key: string | null = KEY,
    userId: string | null = OWNER_ID,
  ) {
    const req = http()
      .post('/internal/v1/mints')
      .set(gatewayHeaders(userId))
      .send({ contentId });
    return key === null ? req : req.set('idempotency-key', key);
  }

  function provenance(contentId: string) {
    return http()
      .get(`/internal/v1/provenance/${contentId}`)
      .set(gatewayHeaders(null));
  }

  describe('authentication and validation', () => {
    it('refuses a call without the gateway credentials', async () => {
      const wrongToken = await mint(ITEM).set('x-service-token', 'nope');
      const wrongName = await mint(ITEM).set('x-service-name', 'lidar');

      for (const response of [wrongToken, wrongName]) {
        expect(response.status).toBe(401);
        expect(response.body).toMatchObject({
          code: 'SERVICE_UNAUTHENTICATED',
          requestId: 'req-mint-1',
        });
      }
    });

    it('refuses a guest', async () => {
      const response = await mint(ITEM, KEY, null);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        code: 'UNAUTHENTICATED',
        message: expect.any(String) as string,
        requestId: 'req-mint-1',
      });
    });

    it.each([null, 'short', 'has spaces in it!!!!'])(
      'requires a valid Idempotency-Key (%p)',
      async (key) => {
        const response = await mint(ITEM, key);

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          code: 'IDEMPOTENCY_KEY_REQUIRED',
        });
      },
    );

    it('validates the body', async () => {
      const response = await mint('not-a-uuid');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        details: [{ field: 'contentId', reason: 'must be a UUID' }],
      });
      expect(content.requests).toHaveLength(0);
    });
  });

  describe('eligibility (S1)', () => {
    it('answers 404 for an unknown item and 409 for a draft', async () => {
      const unknown = await mint('9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c6b');
      const draft = await mint(DRAFT);

      expect(unknown.status).toBe(404);
      expect(unknown.body).toMatchObject({ code: 'CONTENT_NOT_FOUND' });
      expect(draft.status).toBe(409);
      expect(draft.body).toMatchObject({ code: 'CONTENT_NOT_PUBLISHED' });
      expect(repository.rows.size).toBe(0);
    });

    it('lets only the owner mint, asking Content with the relayed caller', async () => {
      const response = await mint(ITEM, KEY, OTHER_ID);

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: 'FORBIDDEN' });
      expect(repository.rows.size).toBe(0);
      const detail = content.requests.find(
        (r) => r.url === `/internal/v1/items/${ITEM}`,
      );
      expect(detail?.headers).toMatchObject({
        'x-service-name': 'nft',
        'x-caller-user-id': OTHER_ID,
        'x-request-id': 'req-mint-1',
      });
    });

    it('fails closed when Content is unavailable', async () => {
      content.failWith = 503;

      const response = await mint(ITEM);

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({ code: 'CONTENT_UNAVAILABLE' });
      expect(repository.rows.size).toBe(0);
    });
  });

  describe('mint and status', () => {
    it('accepts a mint as pending, then confirms it with the event token', async () => {
      t.chain.hold = true;
      const started = await mint(ITEM);

      expect(started.status).toBe(202);
      const body = started.body as MintBody;
      expect(Object.keys(body).sort()).toEqual(MINT_KEYS);
      expect(body).toMatchObject({
        contentId: ITEM,
        status: 'pending',
        network: {
          name: 'Avalanche Fuji',
          chainId: 43113,
          contractAddress: t.chain.network.contractAddress,
        },
        tokenId: null,
        failureReason: null,
        confirmedAt: null,
      });

      await t.processor.whenIdle();
      const polled = await provenance(ITEM);
      expect(polled.status).toBe(200);
      expect(polled.body).toMatchObject({
        contentId: ITEM,
        scope: PROVENANCE_SCOPE,
        mint: { mintId: body.mintId, status: 'pending', tokenId: null },
      });

      t.chain.hold = false;
      await t.processor.process(body.mintId);
      const confirmed = await provenance(ITEM);
      const record = (confirmed.body as { mint: MintBody }).mint;
      expect(record).toMatchObject({
        status: 'confirmed',
        tokenId: '1',
        failureReason: null,
      });
      expect(record.transactionHash).toMatch(/^0x[0-9a-f]{64}$/);
      expect(record['explorerUrl']).toBe(
        `https://testnet.snowtrace.io/tx/${String(record.transactionHash)}`,
      );
      expect(record['confirmedAt']).toEqual(expect.any(String));
      // The token goes to the gallery wallet; only public data is sent.
      expect(t.chain.submitted).toEqual([
        expect.objectContaining({
          contentId: ITEM,
          tokenUri: expect.stringMatching(/^ipfs:\/\//) as string,
          masterHash: expect.stringMatching(/^0x[0-9a-f]{64}$/) as string,
        }),
      ]);
      expect(JSON.stringify(t.chain.submitted)).not.toContain(OWNER_ID);
    });

    it('returns the same mint for a replayed key, without a second send', async () => {
      const first = await mint(ITEM);
      await t.processor.whenIdle();
      const second = await mint(ITEM);

      expect(first.status).toBe(202);
      expect(second.status).toBe(200);
      expect((second.body as MintBody).mintId).toBe(
        (first.body as MintBody).mintId,
      );
      expect((second.body as MintBody).status).toBe('confirmed');
      expect(t.chain.submitted).toHaveLength(1);
    });

    it('refuses another key while a mint is pending or confirmed', async () => {
      t.chain.hold = true;
      await mint(ITEM);
      await t.processor.whenIdle();

      const whilePending = await mint(ITEM, 'mint-key-0000000002');
      t.chain.hold = false;
      await t.processor.resumePending();
      await t.processor.whenIdle();
      const onceConfirmed = await mint(ITEM, 'mint-key-0000000003');

      for (const response of [whilePending, onceConfirmed]) {
        expect(response.status).toBe(409);
        expect(response.body).toMatchObject({ code: 'MINT_ALREADY_REQUESTED' });
      }
    });

    it('refuses a key reused for another item', async () => {
      await mint(ITEM);
      const response = await mint(OTHER_ITEM);

      expect(response.status).toBe(422);
      expect(response.body).toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
    });

    it('resolves concurrent requests to one mint per key and per item', async () => {
      t.chain.hold = true;
      const sameKey = await Promise.all(
        Array.from({ length: 8 }, () => mint(ITEM)),
      );
      const otherKeys = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          mint(OTHER_ITEM, `other-key-${String(i).padStart(10, '0')}`),
        ),
      );

      expect(sameKey.filter((r) => r.status === 202)).toHaveLength(1);
      expect(sameKey.filter((r) => r.status === 200)).toHaveLength(7);
      expect(
        new Set(sameKey.map((r) => (r.body as MintBody).mintId)).size,
      ).toBe(1);
      expect(otherKeys.filter((r) => r.status === 202)).toHaveLength(1);
      expect(otherKeys.filter((r) => r.status === 409)).toHaveLength(7);
      expect(repository.rows.size).toBe(2);
    });

    it('shows a final failure with a safe reason, then allows a new key', async () => {
      t.chain.failures.submit.push(
        new ChainError('INSUFFICIENT_FUNDS', 'The gallery wallet cannot pay'),
      );
      await mint(ITEM);
      await t.processor.whenIdle();

      const failed = (await provenance(ITEM)).body as { mint: MintBody };
      expect(failed.mint).toMatchObject({
        status: 'failed',
        tokenId: null,
        failureReason: MINT_FAILURES.INSUFFICIENT_FUNDS,
      });

      const retry = await mint(ITEM, 'mint-key-0000000002');
      await t.processor.whenIdle();
      expect(retry.status).toBe(202);
      const confirmed = (await provenance(ITEM)).body as { mint: MintBody };
      expect(confirmed.mint).toMatchObject({
        mintId: (retry.body as MintBody).mintId,
        status: 'confirmed',
      });
    });

    it('reconciles with a token that already exists instead of failing', async () => {
      const tokenId = t.chain.mintExisting(ITEM);

      await mint(ITEM);
      await t.processor.whenIdle();

      const body = (await provenance(ITEM)).body as { mint: MintBody };
      expect(body.mint).toMatchObject({
        status: 'confirmed',
        tokenId,
        transactionHash: null,
      });
      expect(body.mint['explorerUrl']).toBe(
        `https://testnet.snowtrace.io/nft/${t.chain.network.contractAddress}/${tokenId}`,
      );
      expect(t.chain.submitted).toHaveLength(0);
    });
  });

  describe('reads', () => {
    it('returns a null mint for an item without a request', async () => {
      const response = await provenance(ITEM);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        contentId: ITEM,
        mint: null,
        scope: NO_MINT_SCOPE,
      });
    });

    it('validates the provenance ContentId', async () => {
      const response = await provenance('nope');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
    });

    it('shows a mint by ID to its requester only', async () => {
      const started = await mint(ITEM);
      const id = (started.body as MintBody).mintId;

      const own = await http()
        .get(`/internal/v1/mints/${id}`)
        .set(gatewayHeaders(OWNER_ID));
      const other = await http()
        .get(`/internal/v1/mints/${id}`)
        .set(gatewayHeaders(OTHER_ID));

      expect(own.status).toBe(200);
      expect((own.body as MintBody).mintId).toBe(id);
      expect(other.status).toBe(404);
      expect(other.body).toMatchObject({ code: 'NOT_FOUND' });
    });
  });
});
