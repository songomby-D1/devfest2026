import { pipeline } from 'node:stream/promises';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  PublicErrorFilter,
  REQUEST_ID_HEADER,
  requestIdOf,
} from '../common/public-error.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { callerOf, GatewayServiceGuard } from './gateway-service.guard.js';
import {
  type CreateGenerationDto,
  createGenerationSchema,
  generationIdSchema,
  type GenerationView,
} from './generation.js';
import { GenerationService, type StoredModel } from './generation.service.js';

/** Image-to-3D generation, relayed by the gateway under `/api/generations`. */
@Controller('internal/v1/generations')
@UseFilters(PublicErrorFilter)
@UseGuards(GatewayServiceGuard)
export class GenerationController {
  private readonly logger = new Logger(GenerationController.name);

  constructor(private readonly generations: GenerationService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  create(
    @Req() request: Request,
    @Body(new ZodValidationPipe(createGenerationSchema))
    body: CreateGenerationDto,
  ): Promise<GenerationView> {
    return this.generations.create(callerOf(request), body);
  }

  @Get()
  list(@Req() request: Request): { generations: GenerationView[] } {
    return { generations: this.generations.list(callerOf(request)) };
  }

  @Get(':id')
  get(
    @Req() request: Request,
    @Param('id', new ZodValidationPipe(generationIdSchema)) id: string,
  ): Promise<GenerationView> {
    return this.generations.get(callerOf(request), id);
  }

  @Get(':id/model.glb')
  async model(
    @Req() request: Request,
    @Res() response: Response,
    @Param('id', new ZodValidationPipe(generationIdSchema)) id: string,
  ): Promise<void> {
    await this.send(
      request,
      response,
      await this.generations.readModel(callerOf(request), id),
    );
  }

  @Get(':id/poster')
  async poster(
    @Req() request: Request,
    @Res() response: Response,
    @Param('id', new ZodValidationPipe(generationIdSchema)) id: string,
  ): Promise<void> {
    await this.send(
      request,
      response,
      await this.generations.readPoster(callerOf(request), id),
    );
  }

  private async send(
    request: Request,
    response: Response,
    file: StoredModel,
  ): Promise<void> {
    response
      .status(HttpStatus.OK)
      .setHeader(REQUEST_ID_HEADER, requestIdOf(request))
      .setHeader('content-type', file.contentType)
      .setHeader('content-length', String(file.object.size))
      // Owner-only content: never stored by a shared cache.
      .setHeader('cache-control', 'private, max-age=3600');
    try {
      await pipeline(file.body, response);
    } catch (error) {
      if (!response.destroyed) response.destroy();
      this.logger.warn(
        `Generation file stream interrupted: ${error instanceof Error ? error.name : 'error'}`,
      );
    }
  }
}
