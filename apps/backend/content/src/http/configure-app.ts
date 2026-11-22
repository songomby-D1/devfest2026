import type { NestExpressApplication } from '@nestjs/platform-express';

/** Matches the description limit with room for the other fields. */
export const JSON_BODY_LIMIT = '64kb';

/** HTTP settings shared by main.ts and the HTTP tests. */
export function configureApp(app: NestExpressApplication): void {
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
  app.disable('x-powered-by');
  app.enableShutdownHooks();
}
