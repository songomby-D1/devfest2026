import { Logger } from '@nestjs/common';
import { ChainError } from '../blockchain/blockchain.port';
import type { AppConfigService } from '../config/app-config.service';
import type {
  MetadataPublisher,
  PreparedMetadata,
} from '../metadata/metadata-publisher.port';
import { chainDown, FakeBlockchain } from '../../test/support/fake-blockchain';
import { InMemoryMintRepository } from '../../test/support/in-memory-mint-repository';
import { MintProcessor } from './mint-processor';
import type { MintRequestRecord } from './mint-request';

const ITEM = '3f2b8c1e-6a4d-4f7b-9c2e-1a2b3c4d5e6f';
const OWNER = '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f';

function prepared(overrides: Partial<PreparedMetadata> = {}): PreparedMetadata {
  return {
    contentId: ITEM,
    tokenUri: 'ipfs://bafy-metadata',
    metadataCid: 'bafy-metadata',
    imageCid: null,
    masterHash: `0x${'a1'.repeat(32)}`,
    title: 'Lamba mena',
    category: 'Craft',
    ...overrides,
  };
}

class StubPublisher implements MetadataPublisher {
  calls = 0;
  failures: Error[] = [];
  result: PreparedMetadata = prepared();

  prepare(): Promise<PreparedMetadata> {
    this.calls += 1;
    const failure = this.failures.shift();
    return failure === undefined
      ? Promise.resolve(this.result)
      : Promise.reject(failure);
  }
}

const config = {
  mint: { maxAttempts: 3, sweepIntervalMs: 0, maxStalledCount: 3 },
  chain: { txTimeoutMs: 1_000 },
} as unknown as AppConfigService;

describe('MintProcessor', () => {
  let repository: InMemoryMintRepository;
  let chain: FakeBlockchain;
  let publisher: StubPublisher;
  let processor: MintProcessor;

  beforeAll(() => {
    for (const level of ['log', 'warn', 'error'] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation(() => undefined);
    }
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    repository = new InMemoryMintRepository();
    chain = new FakeBlockchain();
    publisher = new StubPublisher();
    processor = new MintProcessor(repository, chain, publisher, config);
  });

  async function pending(
    overrides: Partial<MintRequestRecord> = {},
  ): Promise<MintRequestRecord> {
    const created = await repository.create({
      contentId: ITEM,
      requesterId: OWNER,
      idempotencyKey: 'key-000000000000001',
      chainId: 43113,
      contractAddress: chain.network.contractAddress,
      requestId: 'req-1',
    });
    if (created.kind !== 'created') throw new Error('seed failed');
    const record = { ...created.record, ...overrides };
    repository.seed(record);
    return record;
  }

  async function reload(id: string): Promise<MintRequestRecord> {
    const record = await repository.findById(id);
    if (record === null) throw new Error('missing');
    return record;
  }

  it('prepares, sends and confirms, saving the transaction first', async () => {
    const record = await pending();

    await processor.process(record.id);

    expect(await reload(record.id)).toMatchObject({
      status: 'confirmed',
      tokenId: '1',
      tokenUri: 'ipfs://bafy-metadata',
      metadataCid: 'bafy-metadata',
      masterHash: `0x${'a1'.repeat(32)}`,
      txHash: expect.stringMatching(/^0x/) as string,
    });
    expect(chain.submitted).toEqual([
      {
        contentId: ITEM,
        tokenUri: 'ipfs://bafy-metadata',
        title: 'Lamba mena',
        category: 'Craft',
        masterHash: `0x${'a1'.repeat(32)}`,
      },
    ]);
  });

  describe('after a restart (resumePending on boot)', () => {
    it('waits for the receipt of a saved transaction without sending again', async () => {
      chain.hold = true;
      const record = await pending();
      await processor.process(record.id);
      const sent = await reload(record.id);
      expect(sent).toMatchObject({
        status: 'pending',
        txHash: expect.any(String) as string,
      });

      // A new process with the same database and chain.
      chain.hold = false;
      const restarted = new MintProcessor(repository, chain, publisher, config);
      restarted.onApplicationBootstrap();
      await restarted.resumePending();
      await restarted.whenIdle();
      await restarted.onModuleDestroy();

      expect(await reload(record.id)).toMatchObject({
        status: 'confirmed',
        tokenId: '1',
        txHash: sent.txHash,
      });
      expect(chain.submitted).toHaveLength(1);
    });

    it('submits a request that was never sent', async () => {
      const record = await pending();

      processor.onApplicationBootstrap();
      await processor.resumePending();
      await processor.whenIdle();

      expect((await reload(record.id)).status).toBe('confirmed');
      expect(chain.submitted).toHaveLength(1);
    });

    it('sends again when the saved transaction was dropped', async () => {
      const record = await pending({ txHash: `0x${'ee'.repeat(32)}` });

      await processor.process(record.id);

      const after = await reload(record.id);
      expect(after.status).toBe('confirmed');
      expect(after.txHash).not.toBe(`0x${'ee'.repeat(32)}`);
      expect(chain.submitted).toHaveLength(1);
    });

    it('confirms with the existing token when the send happened before a crash', async () => {
      // Crash between send and save: the transaction mined, its hash was lost.
      const tokenId = chain.mintExisting(ITEM);
      const record = await pending();

      await processor.process(record.id);

      expect(await reload(record.id)).toMatchObject({
        status: 'confirmed',
        tokenId,
        txHash: null,
      });
      expect(chain.submitted).toHaveLength(0);
      expect(publisher.calls).toBe(0);
    });
  });

  it('reconciles a reverted transaction when another one minted the item', async () => {
    chain.hold = true;
    const record = await pending();
    await processor.process(record.id);
    // Another transaction mints first; ours then reverts on ArtworkAlreadyMinted.
    const tokenId = chain.mintExisting(ITEM);
    chain.hold = false;

    await processor.process(record.id);

    expect(await reload(record.id)).toMatchObject({
      status: 'confirmed',
      tokenId,
      txHash: null,
    });
  });

  it('confirms when the simulation reports ArtworkAlreadyMinted', async () => {
    const record = await pending();
    jest.spyOn(chain, 'findTokenByArtwork').mockResolvedValueOnce(null);
    jest
      .spyOn(chain, 'submitMint')
      .mockResolvedValueOnce({ kind: 'already_minted', tokenId: '7' });

    await processor.process(record.id);

    expect(await reload(record.id)).toMatchObject({
      status: 'confirmed',
      tokenId: '7',
    });
  });

  it('keeps a request pending after a transient error, then confirms', async () => {
    chain.failures.find.push(chainDown());
    const record = await pending();

    await processor.process(record.id);
    expect(await reload(record.id)).toMatchObject({
      status: 'pending',
      attempts: 1,
      failureCode: 'CHAIN_UNAVAILABLE',
    });

    await processor.process(record.id);
    expect(await reload(record.id)).toMatchObject({
      status: 'confirmed',
      failureCode: null,
    });
  });

  it('fails after MINT_MAX_ATTEMPTS transient errors', async () => {
    publisher.failures.push(new Error('a'), new Error('b'), new Error('c'));
    const record = await pending();

    for (let i = 0; i < 3; i += 1) await processor.process(record.id);

    expect(await reload(record.id)).toMatchObject({
      status: 'failed',
      attempts: 3,
      failureCode: 'METADATA_UNAVAILABLE',
      failedAt: expect.any(Date) as Date,
    });
    expect(chain.submitted).toHaveLength(0);
  });

  it.each([
    ['INSUFFICIENT_FUNDS', new ChainError('INSUFFICIENT_FUNDS', 'no gas')],
    ['CONTRACT_REVERTED', new ChainError('CONTRACT_REVERTED', 'EmptyTitle')],
  ])('fails at once on %s', async (code, error) => {
    chain.failures.submit.push(error);
    const record = await pending();

    await processor.process(record.id);

    expect(await reload(record.id)).toMatchObject({
      status: 'failed',
      failureCode: code,
      attempts: 1,
    });
  });

  it.each([
    ['an empty title', { title: '' }],
    ['a title over 256 bytes', { title: 'é'.repeat(129) }],
    ['a zero hash', { masterHash: `0x${'0'.repeat(64)}` }],
    ['another item', { contentId: '7d6c5b4a-3e2f-4a1b-9c8d-7e6f5a4b3c2d' }],
  ])('refuses prepared metadata with %s', async (_label, overrides) => {
    publisher.result = prepared(overrides);
    const record = await pending();

    await processor.process(record.id);

    expect(await reload(record.id)).toMatchObject({
      status: 'failed',
      failureCode: 'INVALID_METADATA',
    });
    expect(chain.submitted).toHaveLength(0);
  });

  it('ignores a request that is no longer pending', async () => {
    const record = await pending({ status: 'failed', failureCode: 'UNKNOWN' });

    await processor.process(record.id);

    expect(chain.submitted).toHaveLength(0);
    expect(publisher.calls).toBe(0);
  });

  it('queues a request once even when enqueued twice', async () => {
    const record = await pending();

    processor.enqueue(record.id);
    processor.enqueue(record.id);
    await processor.whenIdle();

    expect(chain.submitted).toHaveLength(1);
  });
});
