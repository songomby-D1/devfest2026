import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigService } from './app-config.service';
import { validateEnv } from './env.schema';

/** The only module that reads the environment (nft_context.md §9.8, A8). */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      validate: validateEnv,
      cache: true,
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
