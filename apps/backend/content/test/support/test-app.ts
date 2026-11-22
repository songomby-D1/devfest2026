import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../../src/app.module';
import type { AppConfig } from '../../src/config/app-config';
import { configureApp } from '../../src/http/configure-app';
import {
  ITEM_REPOSITORY,
  type ItemRepository,
} from '../../src/items/item-repository';
import { PrismaService } from '../../src/prisma/prisma.service';
import { GATEWAY_TOKEN } from './fixtures';

/**
 * Boots the real application. With a repository the database is replaced by
 * it; without one the Prisma repository talks to `config.databaseUrl`.
 */
export async function createTestApp(
  config: AppConfig,
  repository?: ItemRepository,
): Promise<NestExpressApplication> {
  let builder = Test.createTestingModule({
    imports: [AppModule.register(config)],
  });
  if (repository !== undefined) {
    builder = builder
      .overrideProvider(ITEM_REPOSITORY)
      .useValue(repository)
      .overrideProvider(PrismaService)
      .useValue({});
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    bodyParser: false,
  });
  app.useLogger(false);
  configureApp(app);
  await app.init();
  return app;
}

/** Headers the gateway sends for a caller (platform contract). */
export function gatewayHeaders(
  userId: string | null,
  permissions: readonly string[] = [],
): Record<string, string> {
  return {
    'x-service-name': 'gateway',
    'x-service-token': GATEWAY_TOKEN,
    'x-caller-permissions': permissions.join(','),
    'x-request-id': 'req-123',
    ...(userId === null ? {} : { 'x-caller-user-id': userId }),
  };
}
