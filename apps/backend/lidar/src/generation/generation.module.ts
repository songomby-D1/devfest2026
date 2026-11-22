import { Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { StorageModule } from '../storage/storage.module.js';
import { GatewayServiceGuard } from './gateway-service.guard.js';
import { GenerationController } from './generation.controller.js';
import { GENERATION_CLOCK, GenerationService } from './generation.service.js';
import {
  HttpMeshyClient,
  MESHY_CLIENT,
  type MeshyClient,
} from './meshy-client.js';

const MESHY_TIMEOUT_MS = 15_000;
const MESHY_DOWNLOAD_TIMEOUT_MS = 120_000;

/** Placeholder when generation is not configured: the guard refuses every call first. */
const disabledMeshy: MeshyClient = {
  createImageTo3d: () => Promise.reject(new Error('Generation disabled')),
  getImageTo3d: () => Promise.reject(new Error('Generation disabled')),
  download: () => Promise.reject(new Error('Generation disabled')),
};

@Module({
  imports: [StorageModule],
  controllers: [GenerationController],
  providers: [
    GenerationService,
    GatewayServiceGuard,
    { provide: GENERATION_CLOCK, useValue: () => Date.now() },
    {
      provide: MESHY_CLIENT,
      inject: [APP_CONFIG],
      useFactory: ({ generation }: AppConfig): MeshyClient =>
        generation === null
          ? disabledMeshy
          : new HttpMeshyClient({
              baseUrl: generation.meshyBaseUrl,
              apiKey: generation.meshyApiKey.value,
              timeoutMs: MESHY_TIMEOUT_MS,
              downloadTimeoutMs: MESHY_DOWNLOAD_TIMEOUT_MS,
              fetch: (input, init) => fetch(input, init),
            }),
    },
  ],
})
export class GenerationModule {}
