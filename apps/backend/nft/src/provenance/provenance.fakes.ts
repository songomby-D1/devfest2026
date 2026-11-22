import type {
  ChainProvenanceReader,
  MintRecordReader,
  OnChainArtwork,
  ProvenanceMintRecord,
} from './provenance.ports';

/**
 * FAKE mint records, kept in memory. It is the default binding until the
 * wiring follow-up binds NFT-04's repository: with no record, every item
 * reads as `mint: null`. Tests seed it with `put`.
 */
export class InMemoryMintRecordReader implements MintRecordReader {
  private readonly records = new Map<string, ProvenanceMintRecord>();
  /** When set, every read rejects with it (database down). */
  failure: Error | undefined;

  put(record: ProvenanceMintRecord): void {
    this.records.set(record.contentId.toLowerCase(), record);
  }

  findLatestForContent(
    contentId: string,
  ): Promise<ProvenanceMintRecord | null> {
    if (this.failure !== undefined) return Promise.reject(this.failure);
    return Promise.resolve(this.records.get(contentId) ?? null);
  }
}

/** Raised by chain readers that cannot reach the chain. */
export class ChainReadUnavailableError extends Error {
  constructor(message = 'The chain cannot be read') {
    super(message);
    this.name = 'ChainReadUnavailableError';
  }
}

/**
 * Default chain binding until the wiring follow-up binds NFT-04's viem
 * client: it reads nothing and always rejects, so confirmed records show as
 * `unverifiable`, never as verified.
 */
export class UnconfiguredChainProvenanceReader implements ChainProvenanceReader {
  getArtwork(): Promise<OnChainArtwork | null> {
    return Promise.reject(new ChainReadUnavailableError('No chain reader'));
  }

  verifyFixity(): Promise<boolean> {
    return Promise.reject(new ChainReadUnavailableError('No chain reader'));
  }

  tokenUri(): Promise<string | null> {
    return Promise.reject(new ChainReadUnavailableError('No chain reader'));
  }
}

export interface FakeToken {
  readonly artwork: OnChainArtwork;
  readonly tokenUri: string;
}

/**
 * FAKE PreservingArt contract for tests: tokens live in memory and follow
 * the contract's rules (`verifyFixity` compares with the stored hash).
 */
export class FakeChainProvenanceReader implements ChainProvenanceReader {
  private readonly tokens = new Map<string, FakeToken>();
  /** `unavailable` rejects every call; `hang` never answers. */
  mode: 'up' | 'unavailable' | 'hang' = 'up';
  calls = 0;

  put(tokenId: string, token: FakeToken): void {
    this.tokens.set(tokenId, token);
  }

  getArtwork(tokenId: string): Promise<OnChainArtwork | null> {
    return this.answer(() => this.tokens.get(tokenId)?.artwork ?? null);
  }

  verifyFixity(tokenId: string, masterHash: string): Promise<boolean> {
    return this.answer(
      () =>
        this.tokens.get(tokenId)?.artwork.masterHash.toLowerCase() ===
        masterHash.toLowerCase(),
    );
  }

  tokenUri(tokenId: string): Promise<string | null> {
    return this.answer(() => this.tokens.get(tokenId)?.tokenUri ?? null);
  }

  private answer<T>(read: () => T): Promise<T> {
    this.calls += 1;
    if (this.mode === 'unavailable') {
      return Promise.reject(new ChainReadUnavailableError('RPC unreachable'));
    }
    if (this.mode === 'hang') return new Promise<T>(() => undefined);
    return Promise.resolve(read());
  }
}
