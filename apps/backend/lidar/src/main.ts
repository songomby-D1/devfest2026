import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { InvalidConfigError, loadAppConfig } from './config/app-config.js';

const logger = new Logger('Bootstrap');

async function bootstrap(): Promise<void> {
  const config = loadAppConfig(process.env);
  const app = await NestFactory.create(AppModule.register(config));
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
