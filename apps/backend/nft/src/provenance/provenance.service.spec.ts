import { Logger } from '@nestjs/common';
import { PublicError } from '../common/public-error';
import type { ContentClient } from '../content/content-client';
import { ContentReferenceService } from '../content/content-reference.service';
import {
  CONTENT_ID,
  chainToken,
  EXPLORER,
  IPFS_GATEWAY,
  MASTER_HASH,
  mintRecord,
  TOKEN_URI,
} from '../../test/fixtures/provenance';
import {
  FakeChainProvenanceReader,
  InMemoryMintRecordReader,
  UnconfiguredChainProvenanceReader,
} from './provenance.fakes';
import type { ChainProvenanceReader } from './provenance.ports';
import { ProvenanceService } from './provenance.service';

type Publication = Awaited<ReturnType<ContentClient['getPublication']>>;

/** Fake ContentClient answering one publication result. */
function contentAnswering(result: Publication): {
  references: ContentReferenceService;
  calls: string[];
} {
  const calls: string[] = [];
  const client = {
    getPublication: (contentId: string): Promise<Publication> => {
      calls.push(contentId);
      return Promise.resolve(result);
    },
  } as unknown as ContentClient;
  return { references: new ContentReferenceService(client), calls };
}

const PUBLISHED: Publication = { kind: 'published', contentId: CONTENT_ID };

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
  let mints: InMemoryMintRecordReader;
  let chain: FakeChainProvenanceReader;

  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  beforeEach(() => {
    mints = new InMemoryMintRecordReader();
    chain = new FakeChainProvenanceReader();
  });

  function service(
    publication: Publication = PUBLISHED,
    reader: ChainProvenanceReader = chain,
  ): ProvenanceService {
    return new ProvenanceService(
      contentAnswering(publication).references,
      mints,
      reader,
      {
        explorerBaseUrl: EXPLORER,
        ipfsGatewayUrl: IPFS_GATEWAY,
        chainTimeoutMs: 50,
      },
    );
  }

  it('answers mint null for a published item without a mint', async () => {
    const view = await service().read(CONTENT_ID.toUpperCase());
    expect(view.contentId).toBe(CONTENT_ID);
    expect(view.mint).toBeNull();
    expect(chain.calls).toBe(0);
  });

  it.each([
    ['unknown', { kind: 'not_found' }],
    [
      'draft',
      { kind: 'not_published', contentId: CONTENT_ID, publicationStatus: 'draft' },
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
    mints.put(mintRecord());
    const error = await rejection(
      service(publication).read(CONTENT_ID, { requestId: 'req-1' }),
    );
    expect(error.getStatus()).toBe(404);
    expect(error.body).toEqual({
      code: 'NOT_FOUND',
      message: 'The item does not exist',
      requestId: 'req-1',
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
    mints.failure = new Error('connect ECONNREFUSED 10.0.0.5:5432');
    const error = await rejection(service().read(CONTENT_ID));
    expect(error.getStatus()).toBe(503);
    expect(error.code).toBe('NFT_UNAVAILABLE');
    expect(JSON.stringify(error.body)).not.toContain('10.0.0.5');
  });

  it('verifies a confirmed mint against the chain', async () => {
    mints.put(mintRecord());
    chain.put('7', chainToken());
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
      },
      checkedAt: expect.any(String) as unknown,
    });
  });

  it('reports a mismatch when the on-chain hash differs from the record', async () => {
    mints.put(mintRecord());
    const token = chainToken();
    chain.put('7', {
      ...token,
      artwork: { ...token.artwork, masterHash: `0x${'00'.repeat(32)}` },
    });
    const view = await service().read(CONTENT_ID);
    expect(view.mint?.verification).toMatchObject({
      state: 'mismatch',
      fixity: false,
    });
  });

  it('reports a mismatch when the on-chain token URI differs', async () => {
    mints.put(mintRecord());
    chain.put('7', chainToken({ tokenUri: 'ipfs://bafkreiothercid0001' }));
    const view = await service().read(CONTENT_ID);
    expect(view.mint?.verification).toMatchObject({
      state: 'mismatch',
      fixity: true,
    });
  });

  it('reports a mismatch when the token does not exist on-chain', async () => {
    mints.put(mintRecord());
    const view = await service().read(CONTENT_ID);
    expect(view.mint?.verification).toMatchObject({
      state: 'mismatch',
      fixity: false,
      onChain: null,
    });
  });

  it('still answers, unverifiable, when the RPC is down', async () => {
    mints.put(mintRecord());
    chain.put('7', chainToken());
    chain.mode = 'unavailable';
    const view = await service().read(CONTENT_ID);
    expect(view.mint).toMatchObject({ status: 'confirmed', tokenId: '7' });
    expect(view.mint?.verification).toMatchObject({
      state: 'unverifiable',
      fixity: null,
      onChain: null,
    });
  });

  it('gives up on a hanging RPC after the timeout', async () => {
    mints.put(mintRecord());
    chain.mode = 'hang';
    const view = await service().read(CONTENT_ID);
    expect(view.mint?.verification?.state).toBe('unverifiable');
  });

  it('is unverifiable with the default unconfigured chain reader', async () => {
    mints.put(mintRecord());
    const view = await service(
      PUBLISHED,
      new UnconfiguredChainProvenanceReader(),
    ).read(CONTENT_ID);
    expect(view.mint?.verification?.state).toBe('unverifiable');
  });

  it('is unverifiable without calling the chain when the record lacks a token', async () => {
    mints.put(mintRecord({ tokenId: null }));
    const view = await service().read(CONTENT_ID);
    expect(view.mint?.verification?.state).toBe('unverifiable');
    expect(chain.calls).toBe(0);
  });

  it('does not read the chain for pending or failed mints', async () => {
    mints.put(mintRecord({ status: 'pending' }));
    expect((await service().read(CONTENT_ID)).mint?.status).toBe('pending');
    mints.put(mintRecord({ status: 'failed', failureCode: 'UNKNOWN' }));
    expect((await service().read(CONTENT_ID)).mint?.status).toBe('failed');
    expect(chain.calls).toBe(0);
  });
});
