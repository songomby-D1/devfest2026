/** The only MVP permission (D13). Ownership is checked by the owning service. */
export type Permission = 'reviewer';

/** Built by the gateway from the verified session and propagated to services (D07). */
export interface CallerContext {
  /** Auth account ID, or `null` for a guest. */
  readonly userId: string | null;
  readonly permissions: readonly Permission[];
  readonly requestId: string;
}

export type ServiceName = 'gateway' | 'nft' | 'lidar';

export type CallerHeaderName =
  | 'x-service-name'
  | 'x-service-token'
  | 'x-caller-user-id'
  | 'x-caller-permissions'
  | 'x-request-id';

export interface RegisterRequest {
  readonly email: string;
  /** 12 to 128 characters after NFKC normalization. */
  readonly password: string;
  readonly displayName?: string | null;
}

export interface RegisterResponse {
  readonly userId: string;
}

export interface LoginRequest {
  readonly email: string;
  readonly password: string;
}

export interface Me {
  readonly userId: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly permissions: readonly Permission[];
  readonly sessionExpiresAt: string;
}

export interface PermissionChangeRequest {
  readonly email: string;
  readonly permission: Permission;
}
