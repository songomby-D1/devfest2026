import { pipeline } from 'node:stream/promises';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Put,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  type PublicErrorBody,
  PublicErrorFilter,
  REQUEST_ID_HEADER,
  requestIdOf,
} from '../common/public-error.js';
import { AdminTokenGuard } from './admin-token.guard.js';
import { AssetFilesService, type StoredFile } from './asset-files.service.js';

@Controller()
@UseFilters(PublicErrorFilter)
export class AssetFilesController {
  private readonly logger = new Logger(AssetFilesController.name);

  constructor(private readonly files: AssetFilesService) {}

  /** Streams a stored file of a ready asset whose content is published. Proxied by the gateway. */
  @Get('files/:assetId/:variant')
  async download(
    @Param('assetId') assetId: string,
    @Param('variant') variant: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const requestId = requestIdOf(request);
    const delivery = await this.files.deliver(
      assetId,
      variant,
      request.headers.range,
      request.method === 'HEAD',
    );
    response.setHeader(REQUEST_ID_HEADER, requestId);

    if (delivery.kind === 'unsatisfiable') {
      const body: PublicErrorBody = {
        code: 'RANGE_NOT_SATISFIABLE',
        message: 'Requested range is outside the file',
        requestId,
      };
      response
        .status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
        .setHeader('content-range', `bytes */${String(delivery.size)}`)
        .setHeader('cache-control', 'no-store')
        .json(body);
      return;
    }

    response.status(delivery.status).set(delivery.headers);
    if (delivery.body === null) {
      response.end();
      return;
    }
    try {
      await pipeline(delivery.body, response);
    } catch (error) {
      // Headers are sent: the connection is closed so the client sees a truncated body.
      if (!response.destroyed) response.destroy();
      if (!request.destroyed) {
        this.logger.warn(
          `Stream of ${variant} interrupted: ${error instanceof Error ? error.name : 'error'} (request ${requestId})`,
        );
      }
    }
  }

  /** Stores one 3D-04a output at the object key registered for the asset. */
  @Put('assets/:assetId/files/:variant')
  @UseGuards(AdminTokenGuard)
  @HttpCode(HttpStatus.CREATED)
  upload(
    @Param('assetId') assetId: string,
    @Param('variant') variant: string,
    @Req() request: Request,
  ): Promise<StoredFile> {
    return this.files.upload(assetId, variant, {
      contentType: request.headers['content-type'],
      contentLength: request.headers['content-length'],
      body: request,
    });
  }
}
