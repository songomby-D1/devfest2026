export type GatewayErrorCode =
  | 'VALIDATION_FAILED'
  | 'IDEMPOTENCY_KEY_REQUIRED'
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'FORBIDDEN'
  | 'FORBIDDEN_ORIGIN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'EMAIL_ALREADY_REGISTERED'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'UNPROCESSABLE'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'AUTH_UNAVAILABLE'
  | 'CONTENT_UNAVAILABLE'
  | 'NFT_UNAVAILABLE'
  | 'LIDAR_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export interface ValidationIssue {
  readonly field: string;
  readonly reason: string;
}

/**
 * Body of every public error. `message` is safe to display. Services may use
 * their own 4xx codes, so consumers must accept codes outside `GatewayErrorCode`.
 */
export interface PublicError {
  readonly code: GatewayErrorCode | (string & {});
  readonly message: string;
  readonly requestId: string;
  readonly details?: readonly ValidationIssue[];
}
