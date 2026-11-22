import { randomUUID } from 'node:crypto';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export interface ValidationIssue {
  readonly field: string;
  readonly reason: string;
}

/** Body of every error (frozen contract): no stack, SQL or upstream detail. */
export interface PublicErrorBody {
  readonly code: string;
  readonly message: string;
  readonly requestId: string;
  readonly details?: readonly ValidationIssue[];
}

/** An error whose code and message are safe to return to the gateway. */
export class PublicError extends HttpException {
  constructor(
    readonly code: string,
    message: string,
    status: HttpStatus,
    readonly details?: readonly ValidationIssue[],
  ) {
    super(message, status);
    this.name = 'PublicError';
  }

  static validation(details: readonly ValidationIssue[]): PublicError {
    return new PublicError(
      'VALIDATION_FAILED',
      'The request is invalid',
      HttpStatus.BAD_REQUEST,
      details,
    );
  }

  static unauthenticated(): PublicError {
    return new PublicError(
      'UNAUTHENTICATED',
      'Sign in to continue',
      HttpStatus.UNAUTHORIZED,
    );
  }

  static serviceUnauthenticated(): PublicError {
    return new PublicError(
      'SERVICE_UNAUTHENTICATED',
      'The calling service is not authenticated',
      HttpStatus.UNAUTHORIZED,
    );
  }

  static forbidden(message = 'You cannot perform this action'): PublicError {
    return new PublicError('FORBIDDEN', message, HttpStatus.FORBIDDEN);
  }

  static notFound(): PublicError {
    return new PublicError(
      'NOT_FOUND',
      'The item does not exist',
      HttpStatus.NOT_FOUND,
    );
  }
}

const CODES_BY_STATUS: Readonly<Partial<Record<number, string>>> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_FAILED',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'NOT_FOUND',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'UNSUPPORTED_MEDIA_TYPE',
};

/** Reuses the gateway's request ID when it is safe to echo, otherwise creates one. */
export function requestIdOf(request: Request): string {
  const provided = request.headers[REQUEST_ID_HEADER];
  return typeof provided === 'string' && SAFE_REQUEST_ID.test(provided)
    ? provided
    : randomUUID();
}

/** Maps every error to `{ code, message, requestId }` with no internal details. */
@Catch()
export class PublicErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(PublicErrorFilter.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const requestId = requestIdOf(request);
    const { status, body } = this.describe(error, requestId);

    if (response.headersSent) {
      response.destroy();
      return;
    }
    response
      .status(status)
      .setHeader(REQUEST_ID_HEADER, requestId)
      .setHeader('cache-control', 'no-store')
      .json(body);
  }

  private describe(
    error: unknown,
    requestId: string,
  ): { status: number; body: PublicErrorBody } {
    if (error instanceof PublicError) {
      return {
        status: error.getStatus(),
        body: {
          code: error.code,
          message: error.message,
          requestId,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      };
    }
    if (error instanceof HttpException && error.getStatus() < 500) {
      const status = error.getStatus();
      return {
        status,
        body: {
          code: CODES_BY_STATUS[status] ?? 'REQUEST_REJECTED',
          message: 'The request was rejected',
          requestId,
        },
      };
    }
    // Only the error name is logged: messages can carry database details.
    this.logger.error(
      `Unhandled ${error instanceof Error ? error.name : 'error'} (request ${requestId})`,
    );
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { code: 'INTERNAL_ERROR', message: 'Unexpected error', requestId },
    };
  }
}
