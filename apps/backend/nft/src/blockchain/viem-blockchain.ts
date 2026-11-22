import type {
  Account,
  Address,
  Chain,
  Hex,
  PublicClient,
  Transport,
  WalletClient,
} from 'viem' with { 'resolution-mode': 'import' };
import { CONTRACT_CATEGORIES } from '../metadata/metadata-publisher.port';
import { artworkKeyOf } from './artwork-key';
import {
  type BlockchainPort,
  ChainError,
  type ChainNetwork,
  type MintParams,
  type OnChainArtwork,
  type SubmitOutcome,
  type TxOutcome,
} from './blockchain.port';
import { PRESERVING_ART_ABI } from './preserving-art.abi';
import { viem, viemAccounts } from './viem';

const {
  BaseError,
  ContractFunctionRevertedError,
  InsufficientFundsError,
  TransactionNotFoundError,
  WaitForTransactionReceiptTimeoutError,
} = viem;

/** Chains the service may talk to: testnets only (deferred-scope guardrail 7). */
export const SUPPORTED_CHAINS: Readonly<Record<number, string>> = {
  43113: 'Avalanche Fuji',
  31337: 'Hardhat local',
};

/** Gas limit = estimate × 1.2 (nft_context.md §9.3). */
const GAS_MARGIN_NUMERATOR = 12n;
const GAS_MARGIN_DENOMINATOR = 10n;

export interface ViemBlockchainOptions {
  readonly rpcUrl: string;
  readonly chainId: number;
  readonly contractAddress: string;
  /** Gallery wallet key. Kept in the viem account only, never logged. */
  readonly privateKey: string;
  readonly rpcTimeoutMs?: number;
  /** Tests inject a fake JSON-RPC transport. Defaults to `http(rpcUrl)`. */
  readonly transport?: Transport;
  readonly pollingIntervalMs?: number;
}

function isHexKey(value: string): value is Hex {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

function walk<T extends Error>(
  error: unknown,
  type: abstract new (...args: never[]) => T,
): T | undefined {
  if (!(error instanceof BaseError)) return undefined;
  const found = error.walk((cause) => cause instanceof type);
  return found instanceof type ? found : undefined;
}

/** Short, secret-free name of an error, for logs and messages. */
function nameOf(error: unknown): string {
  return error instanceof Error ? error.name : 'error';
}

/**
 * Translates a viem error (nft_context.md §9.4). Messages carry only error
 * names: viem messages can quote request arguments and RPC URLs.
 */
export function toChainError(error: unknown): ChainError {
  if (error instanceof ChainError) return error;
  if (walk(error, InsufficientFundsError) !== undefined) {
    return new ChainError(
      'INSUFFICIENT_FUNDS',
      'The gallery wallet cannot pay the gas',
    );
  }
  const revert = walk(error, ContractFunctionRevertedError);
  if (revert !== undefined) {
    return new ChainError(
      'CONTRACT_REVERTED',
      `safeMint reverted (${revert.data?.errorName ?? 'no reason'})`,
    );
  }
  return new ChainError(
    'CHAIN_UNAVAILABLE',
    `The chain RPC failed (${nameOf(error)})`,
  );
}

/** Token ID from an `ArtworkAlreadyMinted` revert, if that is the cause. */
function alreadyMintedTokenId(error: unknown): string | undefined {
  const revert = walk(error, ContractFunctionRevertedError);
  if (revert?.data?.errorName !== 'ArtworkAlreadyMinted') return undefined;
  const tokenId = revert.data.args?.[1];
  return typeof tokenId === 'bigint' ? tokenId.toString() : undefined;
}

/** True when a read reverted because the token does not exist. */
function isNonexistentToken(error: unknown): boolean {
  return (
    walk(error, ContractFunctionRevertedError)?.data?.errorName ===
    'ERC721NonexistentToken'
  );
}

/** A read error as a `ChainError`: never a revert, so always unavailable. */
function readError(error: unknown): ChainError {
  return new ChainError(
    'CHAIN_UNAVAILABLE',
    `The chain RPC failed (${nameOf(error)})`,
  );
}

/** `PreservingArt` on an EVM testnet through viem, signed by the gallery wallet. */
export class ViemBlockchain implements BlockchainPort {
  readonly network: ChainNetwork;
  readonly galleryAddress: Address;
  private readonly contract: Address;
  private readonly account: Account;
  private readonly chain: Chain;
  private readonly publicClient: PublicClient;
  private readonly walletClient: WalletClient;

  constructor(options: ViemBlockchainOptions) {
    const name = SUPPORTED_CHAINS[options.chainId];
    if (name === undefined) {
      throw new Error(
        `CHAIN_ID ${String(options.chainId)} is not a supported testnet`,
      );
    }
    if (!isHexKey(options.privateKey)) {
      throw new Error('MINTER_PRIVATE_KEY is not a 32-byte hex key');
    }
    this.contract = viem.getAddress(options.contractAddress);
    this.account = viemAccounts.privateKeyToAccount(options.privateKey);
    this.galleryAddress = this.account.address;
    this.chain = viem.defineChain({
      id: options.chainId,
      name,
      nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
      rpcUrls: { default: { http: [options.rpcUrl] } },
      testnet: true,
    });
    const transport =
      options.transport ??
      viem.http(options.rpcUrl, {
        timeout: options.rpcTimeoutMs ?? 10_000,
        retryCount: 1,
      });
    const pollingInterval = options.pollingIntervalMs ?? 2_000;
    this.publicClient = viem.createPublicClient({
      chain: this.chain,
      transport,
      pollingInterval,
    });
    this.walletClient = viem.createWalletClient({
      account: this.account,
      chain: this.chain,
      transport,
      pollingInterval,
    });
    this.network = {
      name,
      chainId: options.chainId,
      contractAddress: this.contract,
    };
  }

  async findTokenByArtwork(contentId: string): Promise<string | null> {
    try {
      const tokenId = await this.publicClient.readContract({
        address: this.contract,
        abi: PRESERVING_ART_ABI,
        functionName: 'tokenByArtwork',
        args: [artworkKeyOf(contentId)],
      });
      return tokenId === 0n ? null : tokenId.toString();
    } catch (error) {
      throw toChainError(error);
    }
  }

  async submitMint(params: MintParams): Promise<SubmitOutcome> {
    const call = {
      account: this.account,
      address: this.contract,
      abi: PRESERVING_ART_ABI,
      functionName: 'safeMint',
      args: [
        this.galleryAddress,
        artworkKeyOf(params.contentId),
        params.tokenUri,
        params.title,
        CONTRACT_CATEGORIES.indexOf(params.category),
        params.masterHash as Hex,
      ],
    } as const;
    try {
      // The simulation turns a revert into a typed error before any gas is spent.
      await this.publicClient.simulateContract(call);
      const gas = await this.publicClient.estimateContractGas(call);
      const txHash = await this.walletClient.writeContract({
        ...call,
        chain: this.chain,
        gas: (gas * GAS_MARGIN_NUMERATOR) / GAS_MARGIN_DENOMINATOR,
      });
      return { kind: 'submitted', txHash };
    } catch (error) {
      const tokenId = alreadyMintedTokenId(error);
      if (tokenId !== undefined) return { kind: 'already_minted', tokenId };
      throw toChainError(error);
    }
  }

  async waitForMint(txHash: string, timeoutMs: number): Promise<TxOutcome> {
    const hash = txHash as Hex;
    let receipt;
    try {
      receipt = await this.publicClient.waitForTransactionReceipt({
        hash,
        timeout: timeoutMs,
      });
    } catch (error) {
      if (error instanceof WaitForTransactionReceiptTimeoutError) {
        return this.pendingOrDropped(hash);
      }
      throw toChainError(error);
    }
    if (receipt.status !== 'success') return { kind: 'reverted' };
    // The token ID is read from the event, never guessed (nft_context.md §9.3).
    const [event] = viem.parseEventLogs({
      abi: PRESERVING_ART_ABI,
      eventName: 'ArtworkMinted',
      logs: receipt.logs.filter(
        (log) => log.address.toLowerCase() === this.contract.toLowerCase(),
      ),
    });
    // A mined transaction without the event did not mint: the caller
    // reconciles with tokenByArtwork.
    return event === undefined
      ? { kind: 'reverted' }
      : { kind: 'confirmed', tokenId: event.args.tokenId.toString() };
  }

  async getArtwork(tokenId: string): Promise<OnChainArtwork | null> {
    const artwork = await this.orNull(() =>
      this.publicClient.readContract({
        address: this.contract,
        abi: PRESERVING_ART_ABI,
        functionName: 'getArtwork',
        args: [BigInt(tokenId)],
      }),
    );
    if (artwork === null) return null;
    const category = CONTRACT_CATEGORIES[artwork.category];
    if (category === undefined) {
      throw new ChainError(
        'CHAIN_UNAVAILABLE',
        'getArtwork returned an unknown category',
      );
    }
    return {
      mintedAt: new Date(Number(artwork.mintedAt) * 1000),
      category,
      masterHash: artwork.masterHash.toLowerCase(),
      title: artwork.title,
    };
  }

  async verifyFixity(tokenId: string, masterHash: string): Promise<boolean> {
    const fixity = await this.orNull(() =>
      this.publicClient.readContract({
        address: this.contract,
        abi: PRESERVING_ART_ABI,
        functionName: 'verifyFixity',
        args: [BigInt(tokenId), masterHash as Hex],
      }),
    );
    return fixity ?? false;
  }

  tokenUri(tokenId: string): Promise<string | null> {
    return this.orNull(() =>
      this.publicClient.readContract({
        address: this.contract,
        abi: PRESERVING_ART_ABI,
        functionName: 'tokenURI',
        args: [BigInt(tokenId)],
      }),
    );
  }

  ownerOf(tokenId: string): Promise<string | null> {
    return this.orNull(() =>
      this.publicClient.readContract({
        address: this.contract,
        abi: PRESERVING_ART_ABI,
        functionName: 'ownerOf',
        args: [BigInt(tokenId)],
      }),
    );
  }

  /** Runs a token read; `null` when the token does not exist. */
  private async orNull<T>(read: () => Promise<T>): Promise<T | null> {
    try {
      return await read();
    } catch (error) {
      if (isNonexistentToken(error)) return null;
      throw readError(error);
    }
  }

  private async pendingOrDropped(hash: Hex): Promise<TxOutcome> {
    try {
      await this.publicClient.getTransaction({ hash });
      return { kind: 'pending' };
    } catch (error) {
      if (walk(error, TransactionNotFoundError) !== undefined) {
        return { kind: 'dropped' };
      }
      throw toChainError(error);
    }
  }
}
