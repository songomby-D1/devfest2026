import { Controller, Get } from '@nestjs/common';

export interface HealthResponse {
  readonly status: 'ok';
}

/** Liveness only, without a service token, for Docker and Compose checks. */
@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return { status: 'ok' };
  }
}
