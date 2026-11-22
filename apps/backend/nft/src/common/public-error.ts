import { randomUUID } from 'node:crypto';
import { HttpException, type HttpStatus } from '@nestjs/common';

export const REQUEST_ID_HEADER = 'x-request-id';

/** Same rule as the gateway and Content: safe to echo in headers and bodies. */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export interface ValidationIssue {
  readonly field: string;
  readonly reason: string;
}

/** Body of every public error (platform contract): no stack or upstream detail. */
export interface PublicErrorBody {
  readonly code: string;
  readonly message: string;
  readonly requestId: string;
  readonly details?: readonly ValidationIssue[];
}

/** Reuses a safe correlation ID, otherwise creates one. */
export function safeRequestId(candidate: string | undefined): string {
  return candidate !== undefined && SAFE_REQUEST_ID.test(candidate)
    ? candidate
    : randomUUID();
}

/**
 * An error whose code and message are safe to return to the gateway. The
 * exception response is the public body itself, so Nest's default exception
 * filter already answers `{ code, message, requestId }`.
 */
export class PublicError extends HttpException {
  readonly code: string;
  readonly requestId: string;
  readonly details: readonly ValidationIssue[] | undefined;

  constructor(
    code: string,
    message: string,
    status: HttpStatus,
    requestId: string,
    details?: readonly ValidationIssue[],
  ) {
    const body: PublicErrorBody = {
      code,
      message,
      requestId,
      ...(details === undefined ? {} : { details }),
    };
    super(body, status);
    this.name = 'PublicError';
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }

  get body(): PublicErrorBody {
    return this.getResponse() as PublicErrorBody;
  }
}
