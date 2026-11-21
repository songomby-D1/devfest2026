import { Controller, Get, Inject, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { GatewayError, requestIdOf } from '../common/public-error.js';
import { uuidParam } from '../common/validation.js';
import { missingModel, toModel3dDescriptor } from '../proxy/model3d.js';
import { ProxyService, wildcardRest } from '../proxy/proxy.service.js';
import {
  readJsonCapped,
  UpstreamClient,
  upstreamFailure,
} from '../proxy/upstream-client.js';
import { SessionResolver } from '../session/session-resolver.js';

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{16,128}$/;
const HTTP_NOT_FOUND = 404;

function itemPath(id: string, suffix = ''): string {
  return `/internal/v1/items/${encodeURIComponent(id)}${suffix}`;
}

/** Content, NFT and LiDAR routes of the frozen gateway contract. */
@Controller('api')
export class ItemsController {
  constructor(
    @Inject(ProxyService) private readonly proxy: ProxyService,
    @Inject(UpstreamClient) private readonly upstream: UpstreamClient,
    @Inject(SessionResolver) private readonly sessions: SessionResolver,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get('items')
  list(@Req() request: Request, @Res() response: Response): Promise<void> {
    return this.proxy.forward(request, response, {
      service: 'content',
      method: 'GET',
      path: '/internal/v1/items',
      session: 'optional',
      keepQuery: true,
    });
  }

  @Post('items')
  create(@Req() request: Request, @Res() response: Response): Promise<void> {
    return this.proxy.forward(request, response, {
      service: 'content',
      method: 'POST',
      path: '/internal/v1/items',
      session: 'required',
      body: 'json',
    });
  }

  @Get('items/:id')
  get(
    @Param('id', uuidParam('id')) id: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    return this.proxy.forward(request, response, {
      service: 'content',
      method: 'GET',
      path: itemPath(id),
      session: 'optional',
    });
  }

  @Post('items/:id/media')
  uploadMedia(
    @Param('id', uuidParam('id')) id: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    return this.proxy.forward(request, response, {
      service: 'content',
      method: 'POST',
      path: itemPath(id, '/media'),
      session: 'required',
      body: 'stream',
    });
  }

  @Get('items/:id/media/:mediaId')
  media(
    @Param('id', uuidParam('id')) id: string,
    @Param('mediaId', uuidParam('mediaId')) mediaId: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    return this.proxy.forward(request, response, {
      service: 'content',
      method: 'GET',
      path: itemPath(id, `/media/${encodeURIComponent(mediaId)}`),
      session: 'optional',
    });
  }

  @Post('items/:id/review')
  review(
    @Param('id', uuidParam('id')) id: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    return this.proxy.forward(request, response, {
      service: 'content',
      method: 'POST',
      path: itemPath(id, '/review'),
      session: 'required',
      body: 'json',
    });
  }

  @Post('items/:id/decision')
  decide(
    @Param('id', uuidParam('id')) id: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    return this.proxy.forward(request, response, {
      service: 'content',
      method: 'POST',
      path: itemPath(id, '/decision'),
      session: 'required',
      body: 'json',
    });
  }

  @Post('items/:id/mint')
  mint(
    @Param('id', uuidParam('id')) id: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const key = request.headers['idempotency-key'];
    if (typeof key !== 'string' || !IDEMPOTENCY_KEY.test(key)) {
      throw new GatewayError(
        400,
        'IDEMPOTENCY_KEY_REQUIRED',
        'An Idempotency-Key header of 16 to 128 letters, digits, "-" or "_" is required.',
      );
    }
    return this.proxy.forward(request, response, {
      service: 'nft',
      method: 'POST',
      path: '/internal/v1/mints',
      session: 'required',
      composedBody: { contentId: id },
      headers: { 'idempotency-key': key },
    });
  }

  @Get('items/:id/provenance')
  provenance(
    @Param('id', uuidParam('id')) id: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    return this.proxy.forward(request, response, {
      service: 'nft',
      method: 'GET',
      path: `/internal/v1/provenance/${encodeURIComponent(id)}`,
      session: 'optional',
    });
  }

  @Get('items/:id/model3d')
  async model3d(
    @Param('id', uuidParam('id')) id: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const caller = await this.sessions.resolve(request, response, 'optional');
    const requestId = requestIdOf(request);
    const upstreamResponse = await this.upstream.send({
      service: 'lidar',
      method: 'GET',
      path: `/assets/by-content/${encodeURIComponent(id)}`,
      requestId,
      timeoutMs: this.config.timeouts.upstreamMs,
      caller: { userId: caller.userId, permissions: caller.permissions },
      headers: { accept: 'application/json' },
    });
    if (upstreamResponse.status === HTTP_NOT_FOUND) {
      await upstreamResponse.body?.cancel();
      response.json(missingModel(id));
      return;
    }
    if (!upstreamResponse.ok) {
      throw await this.upstream.toPublicError(
        'lidar',
        upstreamResponse,
        requestId,
      );
    }
    const descriptor = toModel3dDescriptor(
      id,
      await readJsonCapped(upstreamResponse),
    );
    if (descriptor === null) throw upstreamFailure();
    response.json(descriptor);
  }

  @Get('lidar/files/*path')
  modelFile(@Req() request: Request, @Res() response: Response): Promise<void> {
    return this.proxy.forward(request, response, {
      service: 'lidar',
      method: 'GET',
      path: `/files/${wildcardRest(request, '/api/lidar/files/')}`,
      session: 'optional',
    });
  }

  @Get('nft/*path')
  nftRecord(@Req() request: Request, @Res() response: Response): Promise<void> {
    return this.proxy.forward(request, response, {
      service: 'nft',
      method: 'GET',
      path: `/nft/${wildcardRest(request, '/api/nft/')}`,
      session: 'optional',
      keepQuery: true,
    });
  }
}
