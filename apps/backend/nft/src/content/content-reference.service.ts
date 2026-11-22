import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { PublicError, safeRequestId } from '../common/public-error';
import { ContentClient } from './content-client';

/** Public error codes of the publication check (NFT-02). */
export const CONTENT_ERRORS = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  CONTENT_NOT_FOUND: 'CONTENT_NOT_FOUND',
  CONTENT_NOT_PUBLISHED: 'CONTENT_NOT_PUBLISHED',
  CONTENT_UNAVAILABLE: 'CONTENT_UNAVAILABLE',
} as const;

/** Any UUID version, case-insensitive, like Content's `ParseUUIDPipe`. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RequestContext {
  /** Correlation ID from the gateway. Generated when absent or unsafe. */
  readonly requestId?: string | undefined;
}

export interface PublishedContent {
  /** The ContentId as Content returned it (D01). */
  readonly contentId: string;
  readonly requestId: string;
}

/**
 * Checks that a ContentId refers to a published Content item before NFT
 * works on it (D01: the item ID and the publication status are the
 * handoffs from Content). The mint flow (NFT-04) calls `assertPublished`.
 */
@Injectable()
export class ContentReferenceService {
  constructor(@Inject(ContentClient) private readonly client: ContentClient) {}

  /**
   * Resolves when the item is published. Otherwise throws a `PublicError`:
   * `400 VALIDATION_FAILED` for a ContentId that is not a UUID (no call is
   * made), `404 CONTENT_NOT_FOUND`, `409 CONTENT_NOT_PUBLISHED` for a draft
   * or unpublished item, and `503 CONTENT_UNAVAILABLE` when Content cannot
   * answer or refuses the NFT credentials.
   */
  async assertPublished(
    contentId: string,
    context: RequestContext = {},
  ): Promise<PublishedContent> {
    const requestId = safeRequestId(context.requestId);
    if (!UUID.test(contentId)) {
      throw new PublicError(
        CONTENT_ERRORS.VALIDATION_FAILED,
        'The request is invalid',
        HttpStatus.BAD_REQUEST,
        requestId,
        [{ field: 'contentId', reason: 'must be a UUID' }],
      );
    }

    const result = await this.client.getPublication(contentId, requestId);
    switch (result.kind) {
      case 'published':
        return { contentId: result.contentId, requestId };
      case 'not_published':
        // Draft and unpublished share one message for the owner.
        throw new PublicError(
          CONTENT_ERRORS.CONTENT_NOT_PUBLISHED,
          'Only a published item can be certified',
          HttpStatus.CONFLICT,
          requestId,
        );
      case 'not_found':
        throw new PublicError(
          CONTENT_ERRORS.CONTENT_NOT_FOUND,
          'The item does not exist',
          HttpStatus.NOT_FOUND,
          requestId,
        );
      case 'content_unavailable':
        throw new PublicError(
          CONTENT_ERRORS.CONTENT_UNAVAILABLE,
          'The item service is unavailable, try again later',
          HttpStatus.SERVICE_UNAVAILABLE,
          requestId,
        );
    }
  }
}
