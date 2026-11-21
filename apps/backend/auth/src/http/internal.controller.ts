import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../application/auth.service.js';
import type { Permission } from '../domain/permission.js';
import { requestIdOf } from './error-response.js';
import {
  accountIdSchema,
  type CredentialsBody,
  credentialsSchema,
  type PermissionChangeBody,
  permissionChangeSchema,
  type RegisterBody,
  registerSchema,
  type TokenBody,
  tokenSchema,
} from './schemas.js';
import { ServiceTokenGuard } from './service-token.guard.js';
import { ZodValidationPipe } from './zod-validation.pipe.js';

export interface AccountResponse {
  readonly accountId: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly permissions: readonly Permission[];
  readonly createdAt: string;
}

export interface SessionResponse {
  readonly accountId: string;
  readonly token: string;
  readonly expiresAt: string;
}

export interface IntrospectionResponse {
  readonly accountId: string;
  readonly permissions: readonly Permission[];
  readonly expiresAt: string;
}

/** Internal API consumed by the gateway only (docs/api/auth.openapi.yaml). */
@Controller('internal/v1')
@UseGuards(ServiceTokenGuard)
export class InternalController {
  private readonly logger = new Logger(InternalController.name);

  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post('accounts')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterBody,
    @Req() request: Request,
  ): Promise<{ readonly accountId: string }> {
    const result = await this.auth.register(body);
    this.logger.log(
      `Account registered accountId=${result.accountId} requestId=${requestIdOf(request)}`,
    );
    return result;
  }

  @Get('accounts/:accountId')
  async getAccount(
    @Param('accountId', new ZodValidationPipe(accountIdSchema))
    accountId: string,
  ): Promise<AccountResponse> {
    const account = await this.auth.getAccount(accountId);
    return { ...account, createdAt: account.createdAt.toISOString() };
  }

  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  async login(
    @Body(new ZodValidationPipe(credentialsSchema)) body: CredentialsBody,
    @Req() request: Request,
  ): Promise<SessionResponse> {
    const session = await this.auth.login(body);
    this.logger.log(
      `Session opened accountId=${session.accountId} requestId=${requestIdOf(request)}`,
    );
    return { ...session, expiresAt: session.expiresAt.toISOString() };
  }

  @Post('sessions/introspect')
  @HttpCode(HttpStatus.OK)
  async introspect(
    @Body(new ZodValidationPipe(tokenSchema)) body: TokenBody,
  ): Promise<IntrospectionResponse> {
    const session = await this.auth.introspect(body.token);
    return { ...session, expiresAt: session.expiresAt.toISOString() };
  }

  @Post('sessions/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(
    @Body(new ZodValidationPipe(tokenSchema)) body: TokenBody,
  ): Promise<void> {
    await this.auth.revoke(body.token);
  }

  @Post('permissions/grant')
  @HttpCode(HttpStatus.NO_CONTENT)
  async grant(
    @Body(new ZodValidationPipe(permissionChangeSchema))
    body: PermissionChangeBody,
    @Req() request: Request,
  ): Promise<void> {
    await this.auth.grantPermission(body.email, body.permission);
    this.logger.log(
      `Permission ${body.permission} granted requestId=${requestIdOf(request)}`,
    );
  }

  @Post('permissions/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokePermission(
    @Body(new ZodValidationPipe(permissionChangeSchema))
    body: PermissionChangeBody,
    @Req() request: Request,
  ): Promise<void> {
    await this.auth.revokePermission(body.email, body.permission);
    this.logger.log(
      `Permission ${body.permission} revoked requestId=${requestIdOf(request)}`,
    );
  }
}
