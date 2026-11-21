import type {
  ApiErrorBody,
  ContentId,
  Item,
  ItemList,
  MintResult,
  Model3d,
  NewItem,
  Provenance,
  ReviewDecision,
} from './contract';

/** One method per gateway route of the frozen contract. */
export interface ApiClient {
  listItems(): Promise<ItemList>;
  getItem(id: ContentId): Promise<Item>;
  createItem(item: NewItem): Promise<Item>;
  uploadMedia(id: ContentId, file: Blob): Promise<Item>;
  reviewItem(id: ContentId, decision: ReviewDecision): Promise<Item>;
  /** The idempotency key is mandatory: retrying with the same key never mints twice. */
  mintItem(id: ContentId, idempotencyKey: string): Promise<MintResult>;
  getProvenance(id: ContentId): Promise<Provenance>;
  getModel3d(id: ContentId): Promise<Model3d>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.requestId = body.requestId;
  }
}
