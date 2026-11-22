import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { requestIdOf, toErrorResponse } from './error-response.js';

@Catch()
export class AuthExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const { status, body } = toErrorResponse(exception, requestIdOf(request));
    response.status(status).json(body);
  }
}
