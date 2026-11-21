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

/** Body of every error on the routes covered by PublicErrorFilter (frozen contract). */
export interface PublicErrorBody {
  readonly code: string;
  readonly message: string;
  readonly requestId: string;
}

export class PublicError extends HttpException {
  constructor(
    readonly code: string,
    message: string,
    status: HttpStatus,
  ) {
    super(message, status);
    this.name = 'PublicError';
  }
}

const CODES_BY_STATUS: Readonly<Partial<Record<number, string>>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
};

/** Reuses the gateway's request ID when it is safe to echo, otherwise creates one. */
export function requestIdOf(request: Request): string {
  const provided = request.headers[REQUEST_ID_HEADER];
  return typeof provided === 'string' && SAFE_REQUEST_ID.test(provided)
    ? provided
    : randomUUID();
}

/**
 * Maps errors to `{ code, message, requestId }` with no internal details, so the
 * gateway can forward them and the frontend can show its fallback.
 */
@Catch()
export class PublicErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(PublicErrorFilter.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const requestId = requestIdOf(request);
    const { status, code, message } = this.describe(error, requestId);

    if (response.headersSent) {
      response.destroy();
      return;
    }
    const body: PublicErrorBody = { code, message, requestId };
    response
      .status(status)
      .setHeader(REQUEST_ID_HEADER, requestId)
      .setHeader('cache-control', 'no-store')
      .json(body);
  }

  private describe(
    error: unknown,
    requestId: string,
  ): { status: number; code: string; message: string } {
    if (error instanceof PublicError) {
      return {
        status: error.getStatus(),
        code: error.code,
        message: error.message,
      };
    }
    if (error instanceof HttpException && error.getStatus() < 500) {
      const status = error.getStatus();
      return {
        status,
        code: CODES_BY_STATUS[status] ?? 'REQUEST_REJECTED',
        message: 'The request was rejected',
      };
    }
    // Only the error name is logged: messages can carry storage or database details.
    this.logger.error(
      `Unhandled ${error instanceof Error ? error.name : 'error'} (request ${requestId})`,
    );
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Unexpected error',
    };
  }
}
