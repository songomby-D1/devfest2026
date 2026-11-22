import { HttpStatus } from '@nestjs/common';
import { PublicError } from '../common/public-error';
import type {
  ContentClient,
  ItemOwnershipResult,
  PublicationLookupResult,
} from './content-client';
import { ContentReferenceService } from './content-reference.service';

const CONTENT_ID = '3f2b8c1e-6a4d-4f7b-9c2e-1a2b3c4d5e6f';
const REQUEST_ID = 'req-mint-1';

function serviceAnswering(result: PublicationLookupResult): {
  service: ContentReferenceService;
  getPublication: jest.Mock;
} {
  const getPublication = jest.fn().mockResolvedValue(result);
  const client = { getPublication } as unknown as ContentClient;
  return { service: new ContentReferenceService(client), getPublication };
}

async function rejectionOf(promise: Promise<unknown>): Promise<PublicError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof PublicError) return error;
    throw error;
  }
  throw new Error('Expected a PublicError');
}

describe('ContentReferenceService.assertPublished', () => {
  it('resolves for a published item and forwards the request ID', async () => {
    const { service, getPublication } = serviceAnswering({
      kind: 'published',
      contentId: CONTENT_ID,
    });

    await expect(
      service.assertPublished(CONTENT_ID, { requestId: REQUEST_ID }),
    ).resolves.toEqual({ contentId: CONTENT_ID, requestId: REQUEST_ID });
    expect(getPublication).toHaveBeenCalledWith(CONTENT_ID, REQUEST_ID);
  });

  it('generates a request ID when none or an unsafe one is given', async () => {
    const { service, getPublication } = serviceAnswering({
      kind: 'published',
      contentId: CONTENT_ID,
    });

    const first = await service.assertPublished(CONTENT_ID);
    const second = await service.assertPublished(CONTENT_ID, {
      requestId: 'bad id\r\n',
    });

    expect(first.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(second.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(getPublication).toHaveBeenLastCalledWith(
      CONTENT_ID,
      second.requestId,
    );
  });

  it.each(['', 'not-a-uuid', `${CONTENT_ID}x`, '../health', '1'])(
    'rejects the ContentId %p before calling Content',
    async (contentId) => {
      const { service, getPublication } = serviceAnswering({
        kind: 'not_found',
      });

      const error = await rejectionOf(
        service.assertPublished(contentId, { requestId: REQUEST_ID }),
      );

      expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(error.body).toEqual({
        code: 'VALIDATION_FAILED',
        message: 'The request is invalid',
        requestId: REQUEST_ID,
        details: [{ field: 'contentId', reason: 'must be a UUID' }],
      });
      expect(getPublication).not.toHaveBeenCalled();
    },
  );

  it.each<[string, PublicationLookupResult, number, string]>([
    [
      'a draft',
      {
        kind: 'not_published',
        contentId: CONTENT_ID,
        publicationStatus: 'draft',
      },
      HttpStatus.CONFLICT,
      'CONTENT_NOT_PUBLISHED',
    ],
    [
      'an unpublished item',
      {
        kind: 'not_published',
        contentId: CONTENT_ID,
        publicationStatus: 'unpublished',
      },
      HttpStatus.CONFLICT,
      'CONTENT_NOT_PUBLISHED',
    ],
    [
      'a missing item',
      { kind: 'not_found' },
      HttpStatus.NOT_FOUND,
      'CONTENT_NOT_FOUND',
    ],
    [
      'a timeout',
      { kind: 'content_unavailable', reason: 'timeout' },
      HttpStatus.SERVICE_UNAVAILABLE,
      'CONTENT_UNAVAILABLE',
    ],
    [
      'refused credentials',
      { kind: 'content_unavailable', reason: 'unauthenticated' },
      HttpStatus.SERVICE_UNAVAILABLE,
      'CONTENT_UNAVAILABLE',
    ],
  ])('maps %s to %s %s', async (_label, result, status, code) => {
    const { service } = serviceAnswering(result);

    const error = await rejectionOf(
      service.assertPublished(CONTENT_ID, { requestId: REQUEST_ID }),
    );

    expect(error.getStatus()).toBe(status);
    expect(error.body).toEqual({
      code,
      message: expect.any(String) as unknown,
      requestId: REQUEST_ID,
    });
    // The public message never reveals why Content was unavailable.
    expect(error.body.message).not.toMatch(/token|401|timeout/i);
  });
});

describe('ContentReferenceService.assertOwner', () => {
  const caller = {
    userId: '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f',
    permissions: [],
  };

  function serviceWithOwnership(result: ItemOwnershipResult): {
    service: ContentReferenceService;
    getItemOwnership: jest.Mock;
  } {
    const getItemOwnership = jest.fn().mockResolvedValue(result);
    const client = { getItemOwnership } as unknown as ContentClient;
    return { service: new ContentReferenceService(client), getItemOwnership };
  }

  it('resolves for the owner and relays the caller', async () => {
    const { service, getItemOwnership } = serviceWithOwnership({
      kind: 'owner',
    });

    await expect(
      service.assertOwner(CONTENT_ID, caller, { requestId: REQUEST_ID }),
    ).resolves.toBeUndefined();
    expect(getItemOwnership).toHaveBeenCalledWith(
      CONTENT_ID,
      caller,
      REQUEST_ID,
    );
  });

  it.each([
    [{ kind: 'not_owner' }, HttpStatus.FORBIDDEN, 'FORBIDDEN'],
    [{ kind: 'not_found' }, HttpStatus.NOT_FOUND, 'CONTENT_NOT_FOUND'],
    [
      { kind: 'content_unavailable', reason: 'timeout' },
      HttpStatus.SERVICE_UNAVAILABLE,
      'CONTENT_UNAVAILABLE',
    ],
  ] as const)('maps %p to %i %s', async (result, status, code) => {
    const { service } = serviceWithOwnership(result);

    const error = await rejectionOf(
      service.assertOwner(CONTENT_ID, caller, { requestId: REQUEST_ID }),
    );

    expect(error.getStatus()).toBe(status);
    expect(error.body).toEqual({
      code,
      message: expect.any(String) as string,
      requestId: REQUEST_ID,
    });
  });
});
