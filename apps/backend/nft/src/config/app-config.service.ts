import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvSchema, FaultPoint, IpfsDriver, NodeEnv } from './env.schema';

export interface HttpConfig {
  readonly port: number;
}

export interface MediaConfig {
  readonly root: string;
}

export interface ChainConfig {
  readonly rpcUrl: string;
  readonly chainId: number;
  readonly contractAddress: string;
  readonly explorerBaseUrl: string;
  readonly txTimeoutMs: number;
  readonly lowBalanceAvax: number;
}

export interface IpfsConfig {
  readonly driver: IpfsDriver;
  readonly gatewayUrl: string;
  readonly timeoutMs: number;
}

export interface LimitsConfig {
  readonly masterBytes: number;
  readonly imageBytes: number;
  readonly glbBytes: number;
  readonly videoBytes: number;
  readonly previewBytes: number;
}

export interface MintConfig {
  readonly maxStalledCount: number;
}

export interface DevToolsConfig {
  readonly bullBoardEnabled: boolean;
  readonly faultInject: FaultPoint | undefined;
}

/**
 * Typed access to the validated configuration (nft_context.md §9.8).
 * Secrets have dedicated getters so that logging a configuration group
 * can never expose them.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<EnvSchema, true>) {}

  get nodeEnv(): NodeEnv {
    return this.config.get('NODE_ENV', { infer: true });
  }

  get http(): HttpConfig {
    return { port: this.config.get('PORT', { infer: true }) };
  }

  get media(): MediaConfig {
    return { root: this.config.get('MEDIA_ROOT', { infer: true }) };
  }

  get chain(): ChainConfig {
    return {
      rpcUrl: this.config.get('CHAIN_RPC_URL', { infer: true }),
      chainId: this.config.get('CHAIN_ID', { infer: true }),
      contractAddress: this.config.get('CONTRACT_ADDRESS', { infer: true }),
      explorerBaseUrl: this.config.get('EXPLORER_BASE_URL', { infer: true }),
      txTimeoutMs: this.config.get('TX_TIMEOUT_MS', { infer: true }),
      lowBalanceAvax: this.config.get('LOW_BALANCE_AVAX', { infer: true }),
    };
  }

  get minterPrivateKey(): string {
    return this.config.get('MINTER_PRIVATE_KEY', { infer: true });
  }

  get ipfs(): IpfsConfig {
    return {
      driver: this.config.get('IPFS_DRIVER', { infer: true }),
      gatewayUrl: this.config.get('IPFS_GATEWAY_URL', { infer: true }),
      timeoutMs: this.config.get('IPFS_TIMEOUT_MS', { infer: true }),
    };
  }

  get pinataJwt(): string | undefined {
    return this.config.get('PINATA_JWT', { infer: true });
  }

  get limits(): LimitsConfig {
    return {
      masterBytes: this.config.get('MAX_MASTER_BYTES', { infer: true }),
      imageBytes: this.config.get('MAX_IMAGE_BYTES', { infer: true }),
      glbBytes: this.config.get('MAX_GLB_BYTES', { infer: true }),
      videoBytes: this.config.get('MAX_VIDEO_BYTES', { infer: true }),
      previewBytes: this.config.get('MAX_PREVIEW_BYTES', { infer: true }),
    };
  }

  get mint(): MintConfig {
    return {
      maxStalledCount: this.config.get('MINT_MAX_STALLED_COUNT', {
        infer: true,
      }),
    };
  }

  /** `faultInject` is ignored outside `NODE_ENV=test` (nft_context.md §9.3). */
  get devTools(): DevToolsConfig {
    return {
      bullBoardEnabled: this.config.get('BULL_BOARD_ENABLED', { infer: true }),
      faultInject:
        this.nodeEnv === 'test'
          ? this.config.get('FAULT_INJECT', { infer: true })
          : undefined,
    };
  }
}
