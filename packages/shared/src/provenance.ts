import type { ContentId } from './content.js';

export type Model3dStatus = 'ready' | 'processing' | 'missing';

export interface Model3dVariants {
  /** Gateway-relative URLs. */
  readonly poster: string;
  readonly glb1k: string;
  readonly glb2k: string;
}

export interface Model3dDescriptor {
  readonly contentId: ContentId;
  readonly status: Model3dStatus;
  /** `null` unless `status` is `ready`. */
  readonly variants: Model3dVariants | null;
}

export type MintStatus = 'pending' | 'confirmed' | 'failed';

export interface MintNetwork {
  readonly name: string;
  readonly chainId: number;
  readonly contractAddress: string;
}

export interface MintRecord {
  readonly mintId: string;
  readonly contentId: ContentId;
  readonly status: MintStatus;
  readonly network: MintNetwork | null;
  readonly tokenId: string | null;
  readonly transactionHash: string | null;
  readonly explorerUrl: string | null;
  /** Safe, displayable reason when `status` is `failed`. */
  readonly failureReason: string | null;
  readonly requestedAt: string;
  readonly confirmedAt: string | null;
}

export interface Provenance {
  readonly contentId: ContentId;
  readonly mint: MintRecord | null;
  /** States what the record establishes and what it does not. */
  readonly scope: string;
}

export type UpstreamName = 'auth' | 'content' | 'nft' | 'lidar';

export type UpstreamHealth = 'up' | 'down';

export interface GatewayHealth {
  readonly status: 'ok' | 'degraded';
  readonly upstreams: Readonly<Record<UpstreamName, UpstreamHealth>>;
}
