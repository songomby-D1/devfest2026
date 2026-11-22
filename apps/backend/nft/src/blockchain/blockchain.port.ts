import type { ContractCategory } from '../metadata/metadata-publisher.port';

/** Network the tokens live on, as shown in a mint record. */
export interface ChainNetwork {
  readonly name: string;
  readonly chainId: number;
  readonly contractAddress: string;
}

/** Arguments of `PreservingArt.safeMint`, before encoding. */
export interface MintParams {
  /** ContentId (UUID). The port derives `artworkKey` from it. */
  readonly contentId: string;
  /** `ipfs://<metadata CID>`. */
  readonly tokenUri: string;
  readonly title: string;
  readonly category: ContractCategory;
  /** `0x` + 64 lowercase hex chars. */
  readonly masterHash: string;
}

/** Outcome of a mint submission. */
export type SubmitOutcome =
  | { readonly kind: 'submitted'; readonly txHash: string }
  /** `safeMint` would revert with `ArtworkAlreadyMinted`: nothing was sent. */
  | { readonly kind: 'already_minted'; readonly tokenId: string };

/** What the chain says about a submitted mint transaction. */
export type TxOutcome =
  /** Mined with status 1; `tokenId` comes from the `ArtworkMinted` event. */
  | { readonly kind: 'confirmed'; readonly tokenId: string }
  /** Mined with status 0. */
  | { readonly kind: 'reverted' }
  /** Known to the node, no receipt before the timeout. */
  | { readonly kind: 'pending' }
  /** Unknown to the node: never broadcast, dropped or replaced. */
  | { readonly kind: 'dropped' };

/**
 * Failure codes of the chain layer. `CHAIN_UNAVAILABLE` is transient (RPC
 * down, timeout); the others are final for the request.
 */
export type ChainErrorCode =
  'CHAIN_UNAVAILABLE' | 'INSUFFICIENT_FUNDS' | 'CONTRACT_REVERTED';

/** Error of the chain layer. Its message never contains a secret or RPC body. */
export class ChainError extends Error {
  constructor(
    readonly code: ChainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ChainError';
  }

  get retryable(): boolean {
    return this.code === 'CHAIN_UNAVAILABLE';
  }
}

/**
 * The NFT service's only access to the chain (custodial model, S2): the
 * service's gallery wallet signs, pays the gas and receives every token.
 * There is deliberately no transfer, approval or listing operation
 * (docs/deferred-scope.md, guardrails 1 and 2).
 */
export interface BlockchainPort {
  readonly network: ChainNetwork;
  /** Address of the gallery wallet, the `to` of every mint. */
  readonly galleryAddress: string;
  /** `tokenByArtwork(artworkKey)`, or `null` when the item has no token. */
  findTokenByArtwork(contentId: string): Promise<string | null>;
  /** Simulates, then sends `safeMint` to the gallery wallet. */
  submitMint(params: MintParams): Promise<SubmitOutcome>;
  /** Waits for the receipt of a mint transaction, up to `timeoutMs`. */
  waitForMint(txHash: string, timeoutMs: number): Promise<TxOutcome>;
}

/** Nest injection token for the BlockchainPort implementation. */
export const BLOCKCHAIN_PORT = Symbol('BLOCKCHAIN_PORT');
