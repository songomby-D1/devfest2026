import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AuthService } from './application/auth.service.js';
import {
  ACCOUNT_REPOSITORY,
  CLOCK,
  PASSWORD_HASHER,
  type PasswordHasher,
  SESSION_LIMITS,
  SESSION_REPOSITORY,
  SESSION_TOKENS,
} from './application/ports.js';
import { APP_CONFIG, type AppConfig } from './config/app-config.js';
import { AuthExceptionFilter } from './http/auth-exception.filter.js';
import { HealthController } from './http/health.controller.js';
import { InternalController } from './http/internal.controller.js';
import { ServiceTokenGuard } from './http/service-token.guard.js';
import { ConcurrencyLimiter } from './infrastructure/concurrency-limiter.js';
import {
  PrismaAccountRepository,
  PrismaSessionRepository,
} from './infrastructure/prisma-repositories.js';
import { PrismaService } from './infrastructure/prisma.service.js';
import { ScryptPasswordHasher } from './infrastructure/scrypt-password-hasher.js';
import {
  RandomSessionTokens,
  SystemClock,
} from './infrastructure/session-tokens.js';

export interface AppModuleOverrides {
  /** Tests use cheaper scrypt parameters; production keeps the OWASP minimum. */
  readonly passwordHasher?: PasswordHasher;
}

@Module({})
export class AppModule {
  static register(
    config: AppConfig,
    overrides: AppModuleOverrides = {},
  ): DynamicModule {
    const hasher =
      overrides.passwordHasher ??
      new ScryptPasswordHasher(
        new ConcurrencyLimiter(
          config.passwordHashing.concurrency,
          config.passwordHashing.maxWaitMs,
        ),
      );
    return {
      module: AppModule,
      controllers: [InternalController, HealthController],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: SESSION_LIMITS, useValue: config.session },
        { provide: PASSWORD_HASHER, useValue: hasher },
        { provide: SESSION_TOKENS, useClass: RandomSessionTokens },
        { provide: CLOCK, useClass: SystemClock },
        { provide: ACCOUNT_REPOSITORY, useClass: PrismaAccountRepository },
        { provide: SESSION_REPOSITORY, useClass: PrismaSessionRepository },
        { provide: APP_FILTER, useClass: AuthExceptionFilter },
        PrismaService,
        ServiceTokenGuard,
        AuthService,
      ],
      exports: [AuthService],
    };
  }
}
