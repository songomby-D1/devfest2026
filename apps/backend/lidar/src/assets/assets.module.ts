import { Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { AdminTokenGuard } from './admin-token.guard.js';
import { StorageModule } from '../storage/storage.module.js';
import { AssetFilesController } from './asset-files.controller.js';
import { AssetFilesService } from './asset-files.service.js';
import { ASSET_REPOSITORY } from './asset-repository.js';
import { AssetsController } from './assets.controller.js';
import { AssetsService } from './assets.service.js';
import { CONTENT_DIRECTORY } from './content-directory.js';
import { HttpContentDirectory } from './http-content-directory.js';
import { PrismaAssetRepository } from './prisma-asset-repository.js';

const CONTENT_DIRECTORY_TIMEOUT_MS = 3000;

@Module({
  imports: [StorageModule],
  controllers: [AssetsController, AssetFilesController],
  providers: [
    AssetsService,
    AssetFilesService,
    AdminTokenGuard,
    { provide: ASSET_REPOSITORY, useClass: PrismaAssetRepository },
    {
      provide: CONTENT_DIRECTORY,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        new HttpContentDirectory({
          baseUrl: config.contentServiceUrl,
          timeoutMs: CONTENT_DIRECTORY_TIMEOUT_MS,
          fetch: (input, init) => fetch(input, init),
        }),
    },
  ],
})
export class AssetsModule {}
