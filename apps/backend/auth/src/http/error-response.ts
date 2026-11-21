import { randomUUID } from 'node:crypto';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import {
  AuthError,
  type FieldIssue,
  ValidationFailedError,
} from '../domain/errors.js';

export const REQUEST_ID_HEADER = 'x-request-id';
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export interface ErrorBody {
  readonly code: string;
  readonly message: string;
  readonly requestId: string;
  readonly details?: readonly FieldIssue[];
}

/** Errors raised by the HTTP layer itself, with a safe message. */
export class PublicHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PublicHttpError';
  }
}

const STATUS_BY_AUTH_CODE: Readonly<Record<AuthError['code'], number>> = {
  VALIDATION_FAILED: HttpStatus.BAD_REQUEST,
  INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,
  SESSION_INVALID: HttpStatus.UNAUTHORIZED,
  ACCOUNT_NOT_FOUND: HttpStatus.NOT_FOUND,
  EMAIL_ALREADY_REGISTERED: HttpStatus.CONFLICT,
  AUTH_BUSY: HttpStatus.SERVICE_UNAVAILABLE,
};

const GENERIC_BY_STATUS: Readonly<Record<number, readonly [string, string]>> = {
  400: ['VALIDATION_FAILED', 'The request is invalid.'],
  401: ['SERVICE_UNAUTHENTICATED', 'The calling service is not authenticated.'],
  404: ['NOT_FOUND', 'The resource was not found.'],
  405: ['NOT_FOUND', 'The resource was not found.'],
  413: ['VALIDATION_FAILED', 'The request body is too large.'],
  415: ['VALIDATION_FAILED', 'The request body must be JSON.'],
};

const INTERNAL: readonly [string, string] = [
  'INTERNAL_ERROR',
  'An unexpected error occurred.',
];

const logger = new Logger('Errors');

/** Accepts a well-formed caller request ID or creates one, and echoes it in the response. */
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

export function toErrorResponse(
  error: unknown,
  requestId: string,
): { readonly status: number; readonly body: ErrorBody } {
  if (error instanceof AuthError) {
    return {
      status: STATUS_BY_AUTH_CODE[error.code],
      body: {
        code: error.code,
        message: error.message,
        requestId,
        ...(error instanceof ValidationFailedError
          ? { details: error.details }
          : {}),
      },
    };
  }
  if (error instanceof PublicHttpError) {
    return {
      status: error.status,
      body: { code: error.code, message: error.message, requestId },
    };
  }
  const status = statusOf(error);
  const generic = status === undefined ? undefined : GENERIC_BY_STATUS[status];
  if (status !== undefined && generic !== undefined) {
    const [code, message] = generic;
    // Malformed or oversized bodies are validation failures for this API (Auth contract).
    const publicStatus = status >= 413 ? HttpStatus.BAD_REQUEST : status;
    return { status: publicStatus, body: { code, message, requestId } };
  }
  // Only the error class is logged: messages from drivers can contain personal data.
  logger.error(`Unhandled ${errorName(error)} (requestId=${requestId})`);
  const [code, message] = INTERNAL;
  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    body: { code, message, requestId },
  };
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
  const { status, body } = toErrorResponse(error, requestIdOf(request));
  response.status(status).json(body);
}

function statusOf(error: unknown): number | undefined {
  if (error instanceof HttpException) return error.getStatus();
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number' &&
    'type' in error
  ) {
    // body-parser errors carry an HTTP status and a type such as entity.too.large.
    return error.status;
  }
  return undefined;
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}
