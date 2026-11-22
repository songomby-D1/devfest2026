import type { NestExpressApplication } from '@nestjs/platform-express';
import { json, type NextFunction, type Request, type Response } from 'express';
import type { AppConfig } from '../config/app-config.js';
import {
  expressErrorHandler,
  requestIdMiddleware,
} from '../common/public-error.js';
import { originCheck } from '../security/origin-check.js';
import { sessionCookieName } from '../session/session-cookie.js';

/** Auth and operator bodies are small; other JSON bodies are item records and reviews. */
const SMALL_JSON_LIMIT = '10kb';
const JSON_LIMIT = '1mb';
/** Image-to-3D requests carry one compressed image as a data URI (LiDAR caps it at 1.4 MB). */
const GENERATION_JSON_LIMIT = '2mb';

function securityHeaders(
  _request: Request,
  response: Response,
  next: NextFunction,
): void {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  next();
}

/** Shared by the server entry point and the integration tests. */
export function configureApp(
  app: NestExpressApplication,
  config: AppConfig,
): void {
  app.disable('x-powered-by');
  app.use(requestIdMiddleware);
  app.use(securityHeaders);
  if (config.allowedOrigins.length > 0) {
    app.enableCors({
      origin: [...config.allowedOrigins],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: [
        'content-type',
        'idempotency-key',
        'x-request-id',
        'range',
      ],
      exposedHeaders: [
        'x-request-id',
        'retry-after',
        'content-range',
        'accept-ranges',
      ],
      maxAge: 600,
    });
  }
  app.use(
    originCheck(
      config.allowedOrigins,
      sessionCookieName(config.sessionCookie.secure),
    ),
  );
  app.use(['/api/auth', '/api/admin'], json({ limit: SMALL_JSON_LIMIT }));
  app.use('/api/generations', json({ limit: GENERATION_JSON_LIMIT }));
  app.use('/api', json({ limit: JSON_LIMIT }));
  app.use(expressErrorHandler);
  app.enableShutdownHooks();
}
