import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { APP_CONFIG, type AppConfig } from './config/app-config.js';
import { GatewayExceptionFilter } from './common/public-error.js';
import { AdminController } from './http/admin.controller.js';
import {
  AUTH_RATE_LIMITERS,
  AuthController,
  type AuthRateLimiters,
} from './http/auth.controller.js';
import {
  GENERATION_RATE_LIMITER,
  GENERATIONS_PER_HOUR,
  GenerationsController,
} from './http/generations.controller.js';
import { HealthController } from './http/health.controller.js';
import { ItemsController } from './http/items.controller.js';
import { ProxyService } from './proxy/proxy.service.js';
import { UpstreamClient } from './proxy/upstream-client.js';
import { AdminTokenGuard } from './security/admin-token.guard.js';
import { FixedWindowRateLimiter } from './security/rate-limiter.js';
import { AuthClient } from './session/auth-client.js';
import { SessionResolver } from './session/session-resolver.js';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

@Module({})
export class AppModule {
  static register(config: AppConfig): DynamicModule {
    const limiters: AuthRateLimiters = {
      login: new FixedWindowRateLimiter(
        config.authRateLimitPerMinute,
        MINUTE_MS,
      ),
      register: new FixedWindowRateLimiter(
        config.authRateLimitPerMinute,
        MINUTE_MS,
      ),
    };
    return {
      module: AppModule,
      controllers: [
        HealthController,
        AuthController,
        AdminController,
        ItemsController,
        GenerationsController,
      ],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: AUTH_RATE_LIMITERS, useValue: limiters },
        {
          provide: GENERATION_RATE_LIMITER,
          useValue: new FixedWindowRateLimiter(GENERATIONS_PER_HOUR, HOUR_MS),
        },
        { provide: APP_FILTER, useClass: GatewayExceptionFilter },
        UpstreamClient,
        AuthClient,
        SessionResolver,
        ProxyService,
        AdminTokenGuard,
      ],
    };
  }
}
