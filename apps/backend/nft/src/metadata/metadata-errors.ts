import { HttpStatus } from '@nestjs/common';
import { PublicError } from '../common/public-error';
import { CONTENT_ERRORS } from '../content/content-reference.service';

/** Public error codes of the metadata preparation (NFT-03). */
export const METADATA_ERRORS = {
  ...CONTENT_ERRORS,
  CONTENT_NOT_MINTABLE: 'CONTENT_NOT_MINTABLE',
  MEDIA_INTEGRITY_FAILED: 'MEDIA_INTEGRITY_FAILED',
  MEDIA_TOO_LARGE: 'MEDIA_TOO_LARGE',
  IPFS_UNAVAILABLE: 'IPFS_UNAVAILABLE',
} as const;

export function contentNotFound(requestId: string): PublicError {
  return new PublicError(
    METADATA_ERRORS.CONTENT_NOT_FOUND,
    'The item does not exist',
    HttpStatus.NOT_FOUND,
    requestId,
  );
}

export function contentNotPublished(requestId: string): PublicError {
  return new PublicError(
    METADATA_ERRORS.CONTENT_NOT_PUBLISHED,
    'Only a published item can be certified',
    HttpStatus.CONFLICT,
    requestId,
  );
}

export function contentUnavailable(requestId: string): PublicError {
  return new PublicError(
    METADATA_ERRORS.CONTENT_UNAVAILABLE,
    'The item service is unavailable, try again later',
    HttpStatus.SERVICE_UNAVAILABLE,
    requestId,
  );
}

export function contentNotMintable(
  requestId: string,
  reason: string,
): PublicError {
  return new PublicError(
    METADATA_ERRORS.CONTENT_NOT_MINTABLE,
    `This item cannot be certified: ${reason}`,
    HttpStatus.UNPROCESSABLE_ENTITY,
    requestId,
  );
}

export function mediaIntegrityFailed(requestId: string): PublicError {
  return new PublicError(
    METADATA_ERRORS.MEDIA_INTEGRITY_FAILED,
    'The media file does not match its recorded fingerprint',
    HttpStatus.BAD_GATEWAY,
    requestId,
  );
}

export function mediaTooLarge(requestId: string): PublicError {
  return new PublicError(
    METADATA_ERRORS.MEDIA_TOO_LARGE,
    'The media file is too large to certify',
    HttpStatus.UNPROCESSABLE_ENTITY,
    requestId,
  );
}

export function ipfsUnavailable(requestId: string): PublicError {
  return new PublicError(
    METADATA_ERRORS.IPFS_UNAVAILABLE,
    'The public archive is unavailable, try again later',
    HttpStatus.SERVICE_UNAVAILABLE,
    requestId,
  );
}
