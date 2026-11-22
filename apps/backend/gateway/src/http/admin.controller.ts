import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Inject,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { requestIdOf } from '../common/public-error.js';
import { ZodValidationPipe } from '../common/validation.js';
import { AdminTokenGuard } from '../security/admin-token.guard.js';
import { AuthClient } from '../session/auth-client.js';

const permissionChangeSchema = z.strictObject({
  email: z.string().max(320),
  permission: z.enum(['reviewer']),
});

type PermissionChange = z.output<typeof permissionChangeSchema>;

/** Operator routes guarded by the admin token (platform contract). */
@Controller('api/admin')
@UseGuards(AdminTokenGuard)
export class AdminController {
  constructor(@Inject(AuthClient) private readonly auth: AuthClient) {}

  @Put('permissions')
  @HttpCode(HttpStatus.NO_CONTENT)
  async grant(
    @Body(new ZodValidationPipe(permissionChangeSchema)) body: PermissionChange,
    @Req() request: Request,
  ): Promise<void> {
    await this.auth.changePermission('grant', body, requestIdOf(request));
  }

  @Delete('permissions')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(
    @Body(new ZodValidationPipe(permissionChangeSchema)) body: PermissionChange,
    @Req() request: Request,
  ): Promise<void> {
    await this.auth.changePermission('revoke', body, requestIdOf(request));
  }
}
