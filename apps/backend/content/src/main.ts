import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { InvalidConfigError, loadAppConfig } from './config/app-config';
import { configureApp } from './http/configure-app';

const logger = new Logger('Bootstrap');

async function bootstrap(): Promise<void> {
  const config = loadAppConfig(process.env);
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.register(config),
    { bodyParser: false },
  );
  configureApp(app);
  await app.listen(config.port);
  logger.log(`content-service listening on port ${String(config.port)}`);
}

bootstrap().catch((error: unknown) => {
  if (error instanceof InvalidConfigError) {
    logger.error(error.message);
  } else {
    logger.error(
      `content-service failed to start: ${error instanceof Error ? error.name : 'error'}`,
    );
  }
  process.exit(1);
});
