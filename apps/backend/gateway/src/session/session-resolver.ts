import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Permission } from '@devfest2026/shared';
import type { Request, Response } from 'express';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { GatewayError, requestIdOf } from '../common/public-error.js';
import { AuthClient } from './auth-client.js';
import {
  isWellFormedToken,
  readCookie,
  serializeClearedCookie,
  sessionCookieName,
} from './session-cookie.js';

export type SessionMode = 'optional' | 'required';

export interface GuestCaller {
  readonly kind: 'guest';
  readonly userId: null;
  readonly permissions: readonly Permission[];
}

export interface SignedInCaller {
  readonly kind: 'user';
  readonly userId: string;
  readonly permissions: readonly Permission[];
  readonly token: string;
  readonly expiresAt: string;
}

export type Caller = GuestCaller | SignedInCaller;

const GUEST: GuestCaller = { kind: 'guest', userId: null, permissions: [] };

export function unauthenticated(): GatewayError {
  return new GatewayError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
}

/**
 * Turns the session cookie into a caller. Requests without a cookie never reach Auth (guest
 * browsing). Optional routes fall back to guest access when the session is invalid or Auth is
 * down, which never grants more than a guest has; required routes fail closed.
 */
@Injectable()
export class SessionResolver {
  private readonly logger = new Logger(SessionResolver.name);
  private readonly cookieName: string;

  constructor(
    @Inject(AuthClient) private readonly auth: AuthClient,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.cookieName = sessionCookieName(config.sessionCookie.secure);
  }

  tokenOf(request: Request): string | undefined {
    const token = readCookie(request, this.cookieName);
    return token === undefined || token === '' ? undefined : token;
  }

  async requireUser(
    request: Request,
    response: Response,
  ): Promise<SignedInCaller> {
    const caller = await this.resolve(request, response, 'required');
    if (caller.kind === 'guest') throw unauthenticated();
    return caller;
  }

  async resolve(
    request: Request,
    response: Response,
    mode: SessionMode,
  ): Promise<Caller> {
    const token = this.tokenOf(request);
    if (token === undefined) {
      if (mode === 'required') throw unauthenticated();
      return GUEST;
    }

    const requestId = requestIdOf(request);
    let introspection;
    try {
      introspection = isWellFormedToken(token)
        ? await this.auth.introspect(token, requestId)
        : null;
    } catch (error) {
      if (mode === 'required' || !(error instanceof GatewayError)) throw error;
      this.logger.warn(
        `Serving a guest response because Auth failed with ${error.code} (requestId=${requestId})`,
      );
      return GUEST;
    }

    if (introspection === null) {
      response.append(
        'Set-Cookie',
        serializeClearedCookie(this.config.sessionCookie.secure),
      );
      if (mode === 'required') throw unauthenticated();
      return GUEST;
    }
    return {
      kind: 'user',
      userId: introspection.accountId,
      permissions: introspection.permissions,
      token,
      expiresAt: introspection.expiresAt,
    };
  }
}
