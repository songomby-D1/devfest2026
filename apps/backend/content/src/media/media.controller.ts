import { pipeline } from 'node:stream/promises';
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Caller, type CallerContext } from '../common/caller-context';
import {
  type PublicErrorBody,
  PublicError,
  REQUEST_ID_HEADER,
  requestIdOf,
} from '../common/public-error';
import { ServiceTokenGuard } from '../common/service-token.guard';
import type { MediaRefView } from '../items/item-view';
import { MediaService, RANGE_NOT_SATISFIABLE } from './media.service';

function uuidPipe(field: string): ParseUUIDPipe {
  return new ParseUUIDPipe({
    exceptionFactory: () =>
      PublicError.validation([{ field, reason: 'must be a UUID' }]),
  });
}

function headerOf(request: Request, name: string): string | undefined {
  const value = request.headers[name];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Media routes behind the gateway (CONTENT-03). `POST` and `GET` are the
 * Gate 0 `uploadMedia` and `getMedia` routes; `PUT` (replace) and `DELETE`
 * have no gateway route yet (contract need).
 */
@Controller('internal/v1/items/:id/media')
@UseGuards(ServiceTokenGuard)
export class MediaController {
  private readonly logger = new Logger(MediaController.name);

  constructor(@Inject(MediaService) private readonly media: MediaService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  upload(
    @Caller() caller: CallerContext,
    @Param('id', uuidPipe('id')) id: string,
    @Req() request: Request,
  ): Promise<MediaRefView> {
    return this.media.upload(caller, id, {
      headers: request.headers,
      stream: request,
    });
  }

  @Put(':mediaId')
  replace(
    @Caller() caller: CallerContext,
    @Param('id', uuidPipe('id')) id: string,
    @Param('mediaId', uuidPipe('mediaId')) mediaId: string,
    @Req() request: Request,
  ): Promise<MediaRefView> {
    return this.media.replace(caller, id, mediaId, {
      headers: request.headers,
      stream: request,
    });
  }

  @Delete(':mediaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Caller() caller: CallerContext,
    @Param('id', uuidPipe('id')) id: string,
    @Param('mediaId', uuidPipe('mediaId')) mediaId: string,
  ): Promise<void> {
    return this.media.remove(caller, id, mediaId);
  }

  /** Streams a media file, with single byte ranges for video seeking. */
  @Get(':mediaId')
  async download(
    @Caller() caller: CallerContext,
    @Param('id', uuidPipe('id')) id: string,
    @Param('mediaId', uuidPipe('mediaId')) mediaId: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const requestId = requestIdOf(request);
    const delivery = await this.media.deliver(caller, id, mediaId, {
      range: headerOf(request, 'range'),
      ifRange: headerOf(request, 'if-range'),
      ifNoneMatch: headerOf(request, 'if-none-match'),
      headOnly: request.method === 'HEAD',
    });
    response.setHeader(REQUEST_ID_HEADER, requestId);

    if (delivery.kind === 'unsatisfiable') {
      const body: PublicErrorBody = {
        code: RANGE_NOT_SATISFIABLE,
        message: 'The requested range is outside the file',
        requestId,
      };
      response
        .status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
        .setHeader('content-range', `bytes */${String(delivery.size)}`)
        .setHeader('cache-control', delivery.cacheControl)
        .json(body);
      return;
    }

    response.status(delivery.status).set(delivery.headers);
    if (delivery.body === null) {
      if (delivery.status === HttpStatus.NOT_MODIFIED) {
        response.removeHeader('content-length');
      }
      response.end();
      return;
    }
    try {
      await pipeline(delivery.body, response);
    } catch (error) {
      // Headers are sent: closing the connection signals a truncated body.
      if (!response.destroyed) response.destroy();
      if (!request.destroyed) {
        this.logger.warn(
          `Stream of media ${mediaId} interrupted: ${error instanceof Error ? error.name : 'error'} (request ${requestId})`,
        );
      }
    }
  }
}
