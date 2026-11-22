import { Logger } from '@nestjs/common';
import {
  ARTWORK,
  CONTENT_ID,
  EXPLORER,
  IPFS_GATEWAY,
  MASTER_HASH,
  mintRecord,
  TOKEN_URI,
} from '../../test/fixtures/provenance';
import { FakeBlockchain } from '../../test/support/fake-blockchain';
import { InMemoryMintRepository } from '../../test/support/in-memory-mint-repository';
import { PublicError } from '../common/public-error';
import type { AppConfigService } from '../config/app-config.service';
import type { ContentClient } from '../content/content-client';
import { ContentReferenceService } from '../content/content-reference.service';
import type { MintRequestRecord } from '../mint/mint-request';
import { ProvenanceService } from './provenance.service';

type Publication = Awaited<ReturnType<ContentClient['getPublication']>>;

const PUBLISHED: Publication = { kind: 'published', contentId: CONTENT_ID };

const CONFIG = {
  chain: { explorerBaseUrl: EXPLORER },
  ipfs: { gatewayUrl: IPFS_GATEWAY },
} as AppConfigService;

/** ContentReferenceService over a fake client answering one result. */
function references(result: Publication): ContentReferenceService {
  const client = {
    getPublication: (): Promise<Publication> => Promise.resolve(result),
  } as unknown as ContentClient;
  return new ContentReferenceService(client);
}

async function rejection(promise: Promise<unknown>): Promise<PublicError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof PublicError) return error;
    throw error;
  }
  throw new Error('expected a PublicError');
}

describe('ProvenanceService', () => {
  let repository: InMemoryMintRepository;
  let chain: FakeBlockchain;

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    repository = new InMemoryMintRepository();
    chain = new FakeBlockchain();
  });

  function put(record: MintRequestRecord): void {
    repository.rows.set(record.id, record);
  }

  function onChain(tokenUri = TOKEN_URI, artwork = ARTWORK): void {
    chain.artworks.set('7', { artwork, tokenUri });
  }

  function service(publication: Publication = PUBLISHED): ProvenanceService {
    return new ProvenanceService(
      references(publication),
      repository,
      chain,
      CONFIG,
      { chainTimeoutMs: 50 },
    );
  }

  it('answers mint null for a published item without a mint', async () => {
    const view = await service().read(CONTENT_ID.toUpperCase());
    expect(view.contentId).toBe(CONTENT_ID);
    expect(view.mint).toBeNull();
    expect(chain.reads).toBe(0);
  });

  it.each([
    ['unknown', { kind: 'not_found' }],
    [
      'draft',
      {
        kind: 'not_published',
        contentId: CONTENT_ID,
        publicationStatus: 'draft',
      },
    ],
    [
      'unpublished',
      {
        kind: 'not_published',
        contentId: CONTENT_ID,
        publicationStatus: 'unpublished',
      },
    ],
  ] as const)('answers the same 404 for an %s item', async (_, publication) => {
    put(mintRecord());
    const error = await rejection(service(publication).read(CONTENT_ID, 'r-1'));
    expect(error.getStatus()).toBe(404);
    expect(error.body).toEqual({
      code: 'NOT_FOUND',
      message: 'The item does not exist',
      requestId: 'r-1',
    });
  });

  it('rejects a ContentId that is not a UUID', async () => {
    const error = await rejection(service().read('not-a-uuid'));
    expect(error.getStatus()).toBe(400);
    expect(error.code).toBe('VALIDATION_FAILED');
  });

  it('answers 503 when Content cannot confirm publication', async () => {
    const error = await rejection(
      service({ kind: 'content_unavailable', reason: 'timeout' }).read(
        CONTENT_ID,
      ),
    );
    expect(error.getStatus()).toBe(503);
    expect(error.code).toBe('CONTENT_UNAVAILABLE');
  });

  it('answers 503 without detail when the mint records cannot be read', async () => {
    jest
      .spyOn(repository, 'findLatestForContent')
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED 10.0.0.5:5432'));
    const error = await rejection(service().read(CONTENT_ID));
    expect(error.getStatus()).toBe(503);
    expect(error.code).toBe('NFT_UNAVAILABLE');
    expect(JSON.stringify(error.body)).not.toContain('10.0.0.5');
  });

  it('verifies a confirmed mint against the chain', async () => {
    put(mintRecord());
    onChain();
    const view = await service().read(CONTENT_ID);
    expect(view.mint?.verification).toEqual({
      state: 'verified',
      fixity: true,
      onChain: {
        title: 'Lamba mena',
        category: 'Craft',
        mintedAt: '2026-11-22T10:00:05.000Z',
        masterHash: MASTER_HASH,
        tokenUri: TOKEN_URI,
        owner: chain.galleryAddress,
      },
      checkedAt: expect.any(String) as unknown,
    });
  });

  it('reports a mismatch when the on-chain hash differs from the record', async () => {
    put(mintRecord());
    onChain(TOKEN_URI, { ...ARTWORK, masterHash: `0x${'00'.repeat(32)}` });
    const view = await service().read(CONTENT_ID);
    expect(view.mint?.verification).toMatchObject({
      state: 'mismatch',
      fixity: false,
    });
  });

  it('reports a mismatch when the on-chain token URI differs', async () => {
    put(mintRecord());
    onChain('ipfs://bafkreiothercid0001');
    const view = await service().read(CONTENT_ID);
    expect(view.mint?.verification).toMatchObject({
      state: 'mismatch',
      fixity: true,
    });
  });

  it('reports a mismatch when the token does not exist on-chain', async () => {
    put(mintRecord());
    const view = await service().read(CONTENT_ID);
    expect(view.mint?.verification).toMatchObject({
      state: 'mismatch',
      fixity: false,
      onChain: null,
    });
  });

  it('still answers, unverifiable, when the RPC is down', async () => {
    put(mintRecord());
    onChain();
    chain.readsDown = true;
    const view = await service().read(CONTENT_ID);
    expect(view.mint).toMatchObject({ status: 'confirmed', tokenId: '7' });
    expect(view.mint?.verification).toMatchObject({
      state: 'unverifiable',
      fixity: null,
      onChain: null,
    });
  });

  it('gives up on a hanging RPC after the timeout', async () => {
    put(mintRecord());
    chain.readsHang = true;
    const view = await service().read(CONTENT_ID);
    expect(view.mint?.verification?.state).toBe('unverifiable');
  });

  it('is unverifiable without a chain call when no master hash was recorded', async () => {
    // A token found by reconciliation, before metadata was saved.
    put(mintRecord({ masterHash: null, tokenUri: null, txHash: null }));
    const view = await service().read(CONTENT_ID);
    expect(view.mint?.verification?.state).toBe('unverifiable');
    expect(chain.reads).toBe(0);
  });

  it('does not read the chain for pending or failed mints', async () => {
    put(mintRecord({ status: 'pending' }));
    expect((await service().read(CONTENT_ID)).mint?.status).toBe('pending');
    repository.rows.clear();
    put(mintRecord({ status: 'failed', failureCode: 'UNKNOWN' }));
    expect((await service().read(CONTENT_ID)).mint?.status).toBe('failed');
    expect(chain.reads).toBe(0);
  });
});
