import type {
  ApiErrorBody,
  ContentId,
  CreateItemRequest,
  DecisionRequest,
  ItemDetail,
  ItemListQuery,
  ItemPage,
  LoginRequest,
  MediaRef,
  Me,
  MintResult,
  Model3d,
  Provenance,
  RegisterRequest,
  RegisterResponse,
  ReviewRequest,
  UploadOptions,
  ValidationIssue,
} from './contract';

/** One method per gateway route of the frozen contract. */
export interface ApiClient {
  register(request: RegisterRequest): Promise<RegisterResponse>;
  /** Opens a session: the gateway sets an HTTP-only cookie. */
  login(request: LoginRequest): Promise<Me>;
  logout(): Promise<void>;
  /** Rejects with `401 UNAUTHENTICATED` for a guest. */
  me(): Promise<Me>;
  listItems(query?: ItemListQuery): Promise<ItemPage>;
  getItem(id: ContentId): Promise<ItemDetail>;
  createItem(item: CreateItemRequest): Promise<ItemDetail>;
  uploadMedia(
    id: ContentId,
    file: Blob,
    options?: UploadOptions,
  ): Promise<MediaRef>;
  /** Records one claim review: call once for `item` and once for `description`. */
  reviewItem(id: ContentId, review: ReviewRequest): Promise<ItemDetail>;
  /** Publishes, returns or rejects a submission. */
  decideItem(id: ContentId, decision: DecisionRequest): Promise<ItemDetail>;
  /** The idempotency key is mandatory: retrying with the same key never mints twice. */
  mintItem(id: ContentId, idempotencyKey: string): Promise<MintResult>;
  getProvenance(id: ContentId): Promise<Provenance>;
  getModel3d(id: ContentId): Promise<Model3d>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string;
  readonly details: readonly ValidationIssue[];

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.requestId = body.requestId;
    this.details = body.details ?? [];
  }
}

/** Status 0: the request never reached the gateway (offline, aborted, refused). */
export const NETWORK_ERROR_CODE = 'NETWORK_ERROR';
