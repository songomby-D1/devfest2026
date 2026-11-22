import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { InvalidConfigError, loadAppConfig } from './config/app-config.js';

const logger = new Logger('Bootstrap');

async function bootstrap(): Promise<void> {
  const config = loadAppConfig(process.env);
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.register(config),
  );
  // Generation requests carry a compressed image as a data URI (see generation.ts).
  app.useBodyParser('json', { limit: '2mb' });
  app.enableShutdownHooks();
  await app.listen(config.port);
  logger.log(`LiDAR service listening on port ${String(config.port)}`);
}

try {
  await bootstrap();
} catch (error) {
  if (error instanceof InvalidConfigError) {
    logger.error(error.message);
  } else {
    logger.error(
      'LiDAR service failed to start',
      error instanceof Error ? error.stack : undefined,
    );
  }
  process.exitCode = 1;
}
