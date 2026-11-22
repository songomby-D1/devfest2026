import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Me, RegisterResponse } from '@devfest2026/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { GatewayError, requestIdOf } from '../common/public-error.js';
import { ZodValidationPipe } from '../common/validation.js';
import { FixedWindowRateLimiter } from '../security/rate-limiter.js';
import { type Account, AuthClient } from '../session/auth-client.js';
import {
  isWellFormedToken,
  serializeClearedCookie,
  serializeSessionCookie,
} from '../session/session-cookie.js';
import { SessionResolver } from '../session/session-resolver.js';

// Upper bounds only cap parsing cost; Auth applies the contract limits.
const registerSchema = z.strictObject({
  email: z.string().max(320),
  password: z.string().max(1024),
  displayName: z.string().max(240).nullish(),
});
const loginSchema = z.strictObject({
  email: z.string().max(320),
  password: z.string().max(1024),
});

export const AUTH_RATE_LIMITERS = Symbol('AUTH_RATE_LIMITERS');

export interface AuthRateLimiters {
  readonly login: FixedWindowRateLimiter;
  readonly register: FixedWindowRateLimiter;
}

@Controller('api/auth')
export class AuthController {
  constructor(
    @Inject(AuthClient) private readonly auth: AuthClient,
    @Inject(SessionResolver) private readonly sessions: SessionResolver,
    @Inject(AUTH_RATE_LIMITERS) private readonly limiters: AuthRateLimiters,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body(new ZodValidationPipe(registerSchema))
    body: z.output<typeof registerSchema>,
    @Req() request: Request,
  ): Promise<RegisterResponse> {
    this.enforceRateLimit(this.limiters.register, request);
    const { accountId } = await this.auth.register(body, requestIdOf(request));
    return { userId: accountId };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema))
    body: z.output<typeof loginSchema>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Me> {
    this.enforceRateLimit(this.limiters.login, request);
    const requestId = requestIdOf(request);
    const session = await this.auth.openSession(body, requestId);
    response.append(
      'Set-Cookie',
      serializeSessionCookie(session.token, this.config.sessionCookie),
    );
    response.setHeader('Cache-Control', 'no-store');
    const account = await this.auth.getAccount(session.accountId, requestId);
    return toMe(account, session.expiresAt);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = this.sessions.tokenOf(request);
    // The cookie is cleared even if Auth cannot be reached, so the browser forgets the session.
    response.append(
      'Set-Cookie',
      serializeClearedCookie(this.config.sessionCookie.secure),
    );
    if (token !== undefined && isWellFormedToken(token)) {
      await this.auth.revoke(token, requestIdOf(request));
    }
  }

  @Get('me')
  async me(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Me> {
    const caller = await this.sessions.requireUser(request, response);
    response.setHeader('Cache-Control', 'no-store');
    const account = await this.auth.getAccount(
      caller.userId,
      requestIdOf(request),
    );
    return toMe(account, caller.expiresAt);
  }

  private enforceRateLimit(
    limiter: FixedWindowRateLimiter,
    request: Request,
  ): void {
    const decision = limiter.consume(
      request.ip ?? request.socket.remoteAddress ?? 'unknown',
    );
    if (!decision.allowed) {
      throw new GatewayError(
        429,
        'RATE_LIMITED',
        'Too many attempts. Try again in a moment.',
        undefined,
        { 'Retry-After': String(decision.retryAfterSeconds) },
      );
    }
  }
}

function toMe(account: Account, sessionExpiresAt: string): Me {
  return {
    userId: account.accountId,
    email: account.email,
    displayName: account.displayName,
    permissions: account.permissions,
    sessionExpiresAt,
  };
}
