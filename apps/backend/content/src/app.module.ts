import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { PublicErrorFilter } from './common/public-error';
import { ServiceTokenGuard } from './common/service-token.guard';
import { APP_CONFIG, type AppConfig } from './config/app-config';
import { HealthController } from './health/health.controller';
import { ItemsModule } from './items/items.module';
import { PrismaModule } from './prisma/prisma.module';

/** Global module that provides the validated configuration everywhere. */
@Module({})
class ConfigModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: ConfigModule,
      global: true,
      providers: [{ provide: APP_CONFIG, useValue: config }, ServiceTokenGuard],
      exports: [APP_CONFIG, ServiceTokenGuard],
    };
  }
}

@Module({})
export class AppModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [ConfigModule.register(config), PrismaModule, ItemsModule],
      controllers: [HealthController],
      providers: [{ provide: APP_FILTER, useClass: PublicErrorFilter }],
    };
  }
}
