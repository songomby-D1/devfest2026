import { Controller, Get, Inject } from '@nestjs/common';
import type {
  GatewayHealth,
  UpstreamHealth,
  UpstreamName,
} from '@devfest2026/shared';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';

const HEALTH_TIMEOUT_MS = 1500;
const UPSTREAMS: readonly UpstreamName[] = ['auth', 'content', 'nft', 'lidar'];

@Controller('api/health')
export class HealthController {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  @Get()
  async check(): Promise<GatewayHealth> {
    const states = await Promise.all(
      UPSTREAMS.map((name) => this.probe(this.config.upstreams[name].url)),
    );
    const upstreams = Object.fromEntries(
      UPSTREAMS.map((name, index) => [name, states[index] ?? 'down']),
    ) as Record<UpstreamName, UpstreamHealth>;
    return {
      status: states.every((state) => state === 'up') ? 'ok' : 'degraded',
      upstreams,
    };
  }

  private async probe(baseUrl: string): Promise<UpstreamHealth> {
    try {
      const url = new URL(baseUrl);
      url.pathname = `${url.pathname.replace(/\/$/, '')}/health`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      });
      await response.body?.cancel();
      return response.ok ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }
}
