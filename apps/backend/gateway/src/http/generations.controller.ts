import { Controller, Get, Inject, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { GatewayError } from '../common/public-error.js';
import { uuidParam } from '../common/validation.js';
import { ProxyService } from '../proxy/proxy.service.js';
import { FixedWindowRateLimiter } from '../security/rate-limiter.js';
import { SessionResolver } from '../session/session-resolver.js';

export const GENERATION_RATE_LIMITER = Symbol('GENERATION_RATE_LIMITER');

/** Each generation spends paid credits: a few per visitor per hour is enough for the demo. */
export const GENERATIONS_PER_HOUR = 6;

function generationPath(id: string, suffix = ''): string {
  return `/internal/v1/generations/${encodeURIComponent(id)}${suffix}`;
}

/** Image-to-3D generation routes, owned by LiDAR. Signed-in visitors only. */
@Controller('api/generations')
export class GenerationsController {
  constructor(
    @Inject(ProxyService) private readonly proxy: ProxyService,
    @Inject(SessionResolver) private readonly sessions: SessionResolver,
    @Inject(GENERATION_RATE_LIMITER)
    private readonly limiter: FixedWindowRateLimiter,
  ) {}

  @Post()
  async create(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const caller = await this.sessions.resolve(request, response, 'required');
    const decision = this.limiter.consume(caller.userId ?? 'guest');
    if (!decision.allowed) {
      throw new GatewayError(
        429,
        'RATE_LIMITED',
        'Too many generations. Try again later.',
        undefined,
        { 'Retry-After': String(decision.retryAfterSeconds) },
      );
    }
    await this.proxy.forward(request, response, {
      service: 'lidar',
      method: 'POST',
      path: '/internal/v1/generations',
      session: 'required',
      body: 'json',
    });
  }

  @Get()
  list(@Req() request: Request, @Res() response: Response): Promise<void> {
    return this.proxy.forward(request, response, {
      service: 'lidar',
      method: 'GET',
      path: '/internal/v1/generations',
      session: 'required',
    });
  }

  @Get(':id')
  get(
    @Param('id', uuidParam('id')) id: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    return this.proxy.forward(request, response, {
      service: 'lidar',
      method: 'GET',
      path: generationPath(id),
      session: 'required',
    });
  }

  @Get(':id/model.glb')
  model(
    @Param('id', uuidParam('id')) id: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    return this.proxy.forward(request, response, {
      service: 'lidar',
      method: 'GET',
      path: generationPath(id, '/model.glb'),
      session: 'required',
    });
  }

  @Get(':id/poster')
  poster(
    @Param('id', uuidParam('id')) id: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    return this.proxy.forward(request, response, {
      service: 'lidar',
      method: 'GET',
      path: generationPath(id, '/poster'),
      session: 'required',
    });
  }
}
