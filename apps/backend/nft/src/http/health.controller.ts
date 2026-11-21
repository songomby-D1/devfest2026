import { Controller, Get } from '@nestjs/common';

export interface HealthResponse {
  readonly status: 'ok';
}

/**
 * Minimal health check (lot L0). Redis, chain, wallet and queue details
 * join the response in lot L7 (nft_context.md §9.6).
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return { status: 'ok' };
  }
}
