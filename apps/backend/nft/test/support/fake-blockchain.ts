import type {
  BlockchainPort,
  ChainNetwork,
  MintParams,
  SubmitOutcome,
  TxOutcome,
} from '../../src/blockchain/blockchain.port';
import { ChainError } from '../../src/blockchain/blockchain.port';

interface FakeTx {
  readonly params: MintParams;
  state: 'sent' | 'confirmed' | 'reverted';
  tokenId?: string;
}

/**
 * In-memory `PreservingArt`: one token per ContentId, token IDs from 1.
 * Transactions mine when awaited unless `hold` or `drop` says otherwise.
 */
export class FakeBlockchain implements BlockchainPort {
  readonly network: ChainNetwork = {
    name: 'Avalanche Fuji',
    chainId: 43113,
    contractAddress: `0x${'ab'.repeat(20)}`,
  };
  readonly galleryAddress = `0x${'cd'.repeat(20)}`;

  readonly tokens = new Map<string, string>();
  readonly transactions = new Map<string, FakeTx>();
  readonly submitted: MintParams[] = [];
  /** `waitForMint` answers `pending` while true. */
  hold = false;
  /** Sent transactions are forgotten by the node (never mined). */
  drop = false;
  /** Errors thrown by the next calls, by method. */
  readonly failures: {
    find: ChainError[];
    submit: ChainError[];
    wait: ChainError[];
  } = { find: [], submit: [], wait: [] };
  private nextToken = 1;
  private nextTx = 1;

  /** Mints directly, as another transaction would. */
  mintExisting(contentId: string): string {
    const tokenId = String(this.nextToken++);
    this.tokens.set(contentId.toLowerCase(), tokenId);
    return tokenId;
  }

  findTokenByArtwork(contentId: string): Promise<string | null> {
    const failure = this.failures.find.shift();
    if (failure !== undefined) return Promise.reject(failure);
    return Promise.resolve(this.tokens.get(contentId.toLowerCase()) ?? null);
  }

  submitMint(params: MintParams): Promise<SubmitOutcome> {
    const failure = this.failures.submit.shift();
    if (failure !== undefined) return Promise.reject(failure);
    const existing = this.tokens.get(params.contentId.toLowerCase());
    if (existing !== undefined) {
      return Promise.resolve({ kind: 'already_minted', tokenId: existing });
    }
    this.submitted.push(params);
    const txHash = `0x${String(this.nextTx++).padStart(64, '0')}`;
    if (!this.drop) this.transactions.set(txHash, { params, state: 'sent' });
    return Promise.resolve({ kind: 'submitted', txHash });
  }

  waitForMint(txHash: string): Promise<TxOutcome> {
    const failure = this.failures.wait.shift();
    if (failure !== undefined) return Promise.reject(failure);
    const tx = this.transactions.get(txHash);
    if (tx === undefined) return Promise.resolve({ kind: 'dropped' });
    if (tx.state === 'sent') {
      if (this.hold) return Promise.resolve({ kind: 'pending' });
      const key = tx.params.contentId.toLowerCase();
      // Like the contract: a second mint of the same item reverts.
      if (this.tokens.has(key)) {
        tx.state = 'reverted';
      } else {
        tx.state = 'confirmed';
        tx.tokenId = this.mintExisting(key);
      }
    }
    return Promise.resolve(
      tx.state === 'confirmed' && tx.tokenId !== undefined
        ? { kind: 'confirmed', tokenId: tx.tokenId }
        : { kind: 'reverted' },
    );
  }
}

export function chainDown(): ChainError {
  return new ChainError('CHAIN_UNAVAILABLE', 'The chain RPC failed (test)');
}
