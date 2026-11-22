import { Inject, Injectable } from '@nestjs/common';
import type { Permission } from '@devfest2026/shared';
import { z } from 'zod';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import {
  type HttpMethod,
  UpstreamClient,
  upstreamFailure,
} from '../proxy/upstream-client.js';

const permissions = z.array(z.enum(['reviewer']));

const accountCreatedSchema = z.object({ accountId: z.uuid() });
const sessionSchema = z.object({
  accountId: z.uuid(),
  token: z.string().min(1),
  expiresAt: z.iso.datetime(),
});
const introspectionSchema = z.object({
  accountId: z.uuid(),
  permissions,
  expiresAt: z.iso.datetime(),
});
const accountSchema = z.object({
  accountId: z.uuid(),
  email: z.string(),
  displayName: z.string().nullable(),
  permissions,
});

export interface Introspection {
  readonly accountId: string;
  readonly permissions: readonly Permission[];
  readonly expiresAt: string;
}

export interface Account {
  readonly accountId: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly permissions: readonly Permission[];
}

export interface RegistrationBody {
  readonly email: string;
  readonly password: string;
  readonly displayName?: string | null | undefined;
}

export interface CredentialsBody {
  readonly email: string;
  readonly password: string;
}

const HTTP_UNAUTHORIZED = 401;

/** Client of the Auth internal API (docs/api/auth.openapi.yaml). */
@Injectable()
export class AuthClient {
  constructor(
    @Inject(UpstreamClient) private readonly upstream: UpstreamClient,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async register(
    body: RegistrationBody,
    requestId: string,
  ): Promise<{ readonly accountId: string }> {
    return this.call(
      'POST',
      '/internal/v1/accounts',
      body,
      requestId,
      accountCreatedSchema,
    );
  }

  async openSession(
    body: CredentialsBody,
    requestId: string,
  ): Promise<z.output<typeof sessionSchema>> {
    return this.call(
      'POST',
      '/internal/v1/sessions',
      body,
      requestId,
      sessionSchema,
    );
  }

  /** Returns null when Auth reports the session as invalid, expired or revoked. */
  async introspect(
    token: string,
    requestId: string,
  ): Promise<Introspection | null> {
    const response = await this.send(
      'POST',
      '/internal/v1/sessions/introspect',
      { token },
      requestId,
    );
    if (response.status === HTTP_UNAUTHORIZED) {
      const error = await this.upstream.toPublicError(
        'auth',
        response,
        requestId,
      );
      if (error.code === 'SESSION_INVALID') return null;
      throw error;
    }
    return this.parse(response, requestId, introspectionSchema);
  }

  async revoke(token: string, requestId: string): Promise<void> {
    const response = await this.send(
      'POST',
      '/internal/v1/sessions/revoke',
      { token },
      requestId,
    );
    await this.expectNoContent(response, requestId);
  }

  async getAccount(accountId: string, requestId: string): Promise<Account> {
    return this.call(
      'GET',
      `/internal/v1/accounts/${encodeURIComponent(accountId)}`,
      undefined,
      requestId,
      accountSchema,
    );
  }

  async changePermission(
    action: 'grant' | 'revoke',
    body: { readonly email: string; readonly permission: Permission },
    requestId: string,
  ): Promise<void> {
    const response = await this.send(
      'POST',
      `/internal/v1/permissions/${action}`,
      body,
      requestId,
    );
    await this.expectNoContent(response, requestId);
  }

  private async call<Schema extends z.ZodType>(
    method: HttpMethod,
    path: string,
    body: unknown,
    requestId: string,
    schema: Schema,
  ): Promise<z.output<Schema>> {
    const response = await this.send(method, path, body, requestId);
    return this.parse(response, requestId, schema);
  }

  private send(
    method: HttpMethod,
    path: string,
    body: unknown,
    requestId: string,
  ): Promise<Response> {
    return this.upstream.send({
      service: 'auth',
      method,
      path,
      requestId,
      timeoutMs: this.config.timeouts.authMs,
      headers:
        body === undefined
          ? { accept: 'application/json' }
          : { accept: 'application/json', 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  private async parse<Schema extends z.ZodType>(
    response: Response,
    requestId: string,
    schema: Schema,
  ): Promise<z.output<Schema>> {
    if (!response.ok) {
      throw await this.upstream.toPublicError('auth', response, requestId);
    }
    const parsed = schema.safeParse(
      await response.json().catch(() => undefined),
    );
    if (!parsed.success) throw upstreamFailure();
    return parsed.data;
  }

  private async expectNoContent(
    response: Response,
    requestId: string,
  ): Promise<void> {
    if (!response.ok) {
      throw await this.upstream.toPublicError('auth', response, requestId);
    }
    await response.body?.cancel();
  }
}
