import { randomUUID } from 'node:crypto';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { PublicError, ValidationIssue } from '@devfest2026/shared';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

/** An error whose code and message are safe to return to the browser. */
export class GatewayError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: readonly ValidationIssue[],
    readonly headers: Readonly<Record<string, string>> = {},
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

const GENERIC: Readonly<Record<number, readonly [string, string]>> = {
  400: ['VALIDATION_FAILED', 'The request is invalid.'],
  401: ['UNAUTHENTICATED', 'Sign in to continue.'],
  403: ['FORBIDDEN', 'You are not allowed to do this.'],
  404: ['NOT_FOUND', 'The resource was not found.'],
  405: ['NOT_FOUND', 'The resource was not found.'],
  409: ['CONFLICT', 'The request conflicts with the current state.'],
  413: ['PAYLOAD_TOO_LARGE', 'The request body is too large.'],
  415: ['UNSUPPORTED_MEDIA_TYPE', 'This media type is not supported.'],
  422: ['UNPROCESSABLE', 'The request cannot be processed.'],
  429: ['RATE_LIMITED', 'Too many requests. Try again later.'],
};

export function genericError(status: number): GatewayError {
  const generic = GENERIC[status];
  if (generic !== undefined) return new GatewayError(status, ...generic);
  if (status >= 400 && status < 500) {
    return new GatewayError(
      400,
      'VALIDATION_FAILED',
      'The request is invalid.',
    );
  }
  return internalError();
}

export function internalError(): GatewayError {
  return new GatewayError(
    500,
    'INTERNAL_ERROR',
    'An unexpected error occurred.',
  );
}

export function validationError(
  details: readonly ValidationIssue[],
): GatewayError {
  return new GatewayError(
    400,
    'VALIDATION_FAILED',
    'The request is invalid.',
    details,
  );
}

const logger = new Logger('Errors');

export function toPublicError(
  error: unknown,
  requestId: string,
): { readonly error: GatewayError; readonly body: PublicError } {
  const gatewayError = asGatewayError(error, requestId);
  return {
    error: gatewayError,
    body: {
      code: gatewayError.code,
      message: gatewayError.message,
      requestId,
      ...(gatewayError.details === undefined
        ? {}
        : { details: gatewayError.details }),
    },
  };
}

function asGatewayError(error: unknown, requestId: string): GatewayError {
  if (error instanceof GatewayError) return error;
  if (error instanceof HttpException) return genericError(error.getStatus());
  if (isBodyParserError(error)) {
    return error.type === 'entity.too.large'
      ? genericError(413)
      : genericError(400);
  }
  // Only the error class is logged: messages can contain request data.
  logger.error(
    `Unhandled ${error instanceof Error ? error.name : 'UnknownError'} (requestId=${requestId})`,
  );
  return internalError();
}

function isBodyParserError(
  error: unknown,
): error is { readonly status: number; readonly type: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number' &&
    'type' in error &&
    typeof error.type === 'string'
  );
}

export function sendPublicError(
  response: Response,
  error: unknown,
  requestId: string,
): void {
  const { error: gatewayError, body } = toPublicError(error, requestId);
  for (const [name, value] of Object.entries(gatewayError.headers)) {
    response.setHeader(name, value);
  }
  response.status(gatewayError.status).json(body);
}

export function requestIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const provided = request.headers[REQUEST_ID_HEADER];
  const requestId =
    typeof provided === 'string' && REQUEST_ID_PATTERN.test(provided)
      ? provided
      : randomUUID();
  request.headers[REQUEST_ID_HEADER] = requestId;
  response.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}

export function requestIdOf(request: Request): string {
  const value = request.headers[REQUEST_ID_HEADER];
  return typeof value === 'string' ? value : 'unknown';
}

/** Express error handler for failures raised before routing, such as body parsing. */
export function expressErrorHandler(
  error: unknown,
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  if (response.headersSent) {
    next(error);
    return;
  }
  sendPublicError(response, error, requestIdOf(request));
}

@Catch()
export class GatewayExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    if (response.headersSent) {
      // A streamed upstream body failed midway: the only safe option is to end the response.
      response.destroy();
      return;
    }
    sendPublicError(response, exception, requestIdOf(request));
  }
}
