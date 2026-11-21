import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { EnvValidationError } from './config/env.schema';

const logger = new Logger('Bootstrap');

/** Startup order of nft_context.md §9.7. Chain checks arrive in lot L5. */
async function bootstrap(): Promise<void> {
  // An invalid configuration rejects here (ConfigModule validation) and is
  // reported by the handler below instead of aborting with a stack trace.
  const app = await NestFactory.create(AppModule, { abortOnError: false });
  app.enableShutdownHooks();

  const config = app.get(AppConfigService);
  await app.listen(config.http.port);

  logger.log(
    `nft-service listening on port ${String(config.http.port)} ` +
      `(chainId=${String(config.chain.chainId)}, ` +
      `contract=${config.chain.contractAddress}, ` +
      `ipfsDriver=${config.ipfs.driver})`,
  );
}

bootstrap().catch((error: unknown) => {
  if (error instanceof EnvValidationError) {
    logger.error(error.message);
  } else if (error instanceof Error) {
    logger.error(error.stack ?? error.message);
  } else {
    logger.error(String(error));
  }
  process.exit(1);
});
