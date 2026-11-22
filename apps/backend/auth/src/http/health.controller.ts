import { Controller, Get, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '../infrastructure/prisma.service.js';
import { PublicHttpError } from './error-response.js';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<{ readonly status: 'ok' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      this.logger.warn(
        `Database health check failed: ${error instanceof Error ? error.name : 'UnknownError'}`,
      );
      throw new PublicHttpError(
        503,
        'DATABASE_UNAVAILABLE',
        'The database is unavailable.',
      );
    }
    return { status: 'ok' };
  }
}
