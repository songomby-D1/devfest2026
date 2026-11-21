import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { InvalidConfigError, loadAppConfig } from './config/app-config.js';
import { configureApp } from './http/configure-app.js';

const logger = new Logger('Bootstrap');

async function bootstrap(): Promise<void> {
  const config = loadAppConfig(process.env);
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.register(config),
    { bodyParser: false },
  );
  configureApp(app, config);
  await app.listen(config.port);
  logger.log(`Gateway listening on port ${String(config.port)}`);
}

try {
  await bootstrap();
} catch (error) {
  if (error instanceof InvalidConfigError) {
    logger.error(error.message);
  } else {
    logger.error(
      `Gateway failed to start: ${error instanceof Error ? error.name : 'UnknownError'}`,
    );
  }
  process.exitCode = 1;
}
