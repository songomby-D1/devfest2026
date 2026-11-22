import { type DynamicModule, Module } from '@nestjs/common';
import { AssetsModule } from './assets/assets.module.js';
import { APP_CONFIG, type AppConfig } from './config/app-config.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({})
export class AppModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      global: true,
      imports: [PrismaModule, HealthModule, AssetsModule],
      providers: [{ provide: APP_CONFIG, useValue: config }],
      exports: [APP_CONFIG],
    };
  }
}
