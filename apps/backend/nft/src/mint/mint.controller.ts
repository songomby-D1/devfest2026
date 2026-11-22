import {
  Body,
  Controller,
  Get,
  Headers,
  HttpStatus,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Caller, type CallerContext } from '../common/caller-context';
import { ServiceTokenGuard } from '../common/service-token.guard';
import {
  cacheControlOf,
  NO_STORE,
  type ProvenanceView,
} from '../provenance/provenance-view';
import { ProvenanceService } from '../provenance/provenance.service';
import { MintService } from './mint.service';
import type { MintView } from './mint-view';

/**
 * Internal routes the gateway calls (platform contract, service-to-service
 * rules): `POST /api/items/{id}/mint` becomes `POST /internal/v1/mints` with
 * `{ contentId }` and the `Idempotency-Key` header, and
 * `GET /api/items/{id}/provenance` becomes `GET /internal/v1/provenance/{id}`.
 * docs/api/nft.yaml documents them.
 */
@Controller('internal/v1')
@UseGuards(ServiceTokenGuard)
export class MintController {
  constructor(
    private readonly mints: MintService,
    private readonly provenanceData: ProvenanceService,
  ) {}

  /** 202 with a new pending mint, 200 with the mint of a replayed key. */
  @Post('mints')
  async start(
    @Caller() caller: CallerContext,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MintView> {
    const result = await this.mints.start(caller, idempotencyKey, body);
    response.status(result.created ? HttpStatus.ACCEPTED : HttpStatus.OK);
    return result.mint;
  }

  /** The caller's own mint, by ID. */
  @Get('mints/:mintId')
  get(
    @Caller() caller: CallerContext,
    @Param('mintId') mintId: string,
  ): Promise<MintView> {
    return this.mints.get(caller, mintId);
  }

  /**
   * Mint status and provenance display data of a published item (NFT-05).
   * Guests may read it; poll while pending. Unknown, draft and unpublished
   * items answer the same 404.
   */
  @Get('provenance/:contentId')
  async provenance(
    @Caller() caller: CallerContext,
    @Param('contentId') contentId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ProvenanceView> {
    // Errors keep this header; a success replaces it.
    response.setHeader('Cache-Control', NO_STORE);
    const view = await this.provenanceData.read(contentId, caller.requestId);
    response.setHeader('Cache-Control', cacheControlOf(view));
    return view;
  }
}
