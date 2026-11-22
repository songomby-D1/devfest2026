import type { ArgumentsHost } from '@nestjs/common';
import { BadRequestException, HttpStatus, Logger } from '@nestjs/common';
import { PublicError, PublicErrorFilter } from './public-error';

interface Captured {
  status?: number;
  body?: unknown;
  headers: Record<string, string>;
}

function hostFor(captured: Captured, requestId?: string): ArgumentsHost {
  const response = {
    headersSent: false,
    status(code: number) {
      captured.status = code;
      return response;
    },
    setHeader(name: string, value: string) {
      captured.headers[name] = value;
      return response;
    },
    json(body: unknown) {
      captured.body = body;
      return response;
    },
  };
  const request = {
    headers: requestId === undefined ? {} : { 'x-request-id': requestId },
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
}

describe('PublicErrorFilter', () => {
  const filter = new PublicErrorFilter();

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('returns a public error with its code, message and details', () => {
    const captured: Captured = { headers: {} };
    filter.catch(
      PublicError.validation([{ field: 'title', reason: 'must not be empty' }]),
      hostFor(captured, 'req-1'),
    );

    expect(captured.status).toBe(400);
    expect(captured.body).toEqual({
      code: 'VALIDATION_FAILED',
      message: 'The request is invalid',
      requestId: 'req-1',
      details: [{ field: 'title', reason: 'must not be empty' }],
    });
    expect(captured.headers['x-request-id']).toBe('req-1');
  });

  it('hides the message of framework 4xx errors', () => {
    const captured: Captured = { headers: {} };
    filter.catch(
      new BadRequestException('Unexpected token } in JSON'),
      hostFor(captured),
    );

    expect(captured.status).toBe(HttpStatus.BAD_REQUEST);
    expect(captured.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      message: 'The request was rejected',
    });
    expect(JSON.stringify(captured.body)).not.toContain('Unexpected token');
  });

  it('turns unknown errors into INTERNAL_ERROR without internal details', () => {
    const captured: Captured = { headers: {} };
    filter.catch(
      new Error('connect ECONNREFUSED postgresql://content_runtime:pw@db'),
      hostFor(captured, 'req-2'),
    );

    expect(captured.status).toBe(500);
    expect(captured.body).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Unexpected error',
      requestId: 'req-2',
    });
  });
});
