import type { NestExpressApplication } from '@nestjs/platform-express';
import { expressErrorHandler, requestIdMiddleware } from './error-response.js';

/** Bodies above 10 KB are rejected before parsing (Auth contract, edge cases). */
export const JSON_BODY_LIMIT = '10kb';

/** Shared by the server entry point and the integration tests. */
export function configureApp(app: NestExpressApplication): void {
  app.use(requestIdMiddleware);
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT, strict: true });
  app.use(expressErrorHandler);
  app.enableShutdownHooks();
}
