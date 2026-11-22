import { Controller, Get, Headers, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { ProvenanceView } from './provenance-view';
import { ProvenanceService } from './provenance.service';

/** Confirmed records are immutable on-chain: a short public cache is safe. */
export const CONFIRMED_CACHE = 'public, max-age=60';
/** A confirmed record the chain could not check: retry the check soon. */
export const UNVERIFIED_CACHE = 'public, max-age=15';
/** No mint, pending or failed: the status may change on the next poll. */
export const NO_STORE = 'no-store';

export function cacheControlOf(view: ProvenanceView): string {
  if (view.mint?.status !== 'confirmed') return NO_STORE;
  return view.mint.verification?.state === 'unverifiable'
    ? UNVERIFIED_CACHE
    : CONFIRMED_CACHE;
}

/**
 * Read-only provenance route (NFT-05). Guests may call it. The gateway's
 * frozen `GET /api/items/{id}/provenance` forwards to
 * `GET /internal/v1/provenance/{id}`, which NFT-04 serves today; the wiring
 * follow-up makes that route answer with `ProvenanceService.read` (see
 * docs/provenance.md). This path is NFT-05's own, collision-free entry.
 */
@Controller('internal/v1/items')
export class ProvenanceController {
  constructor(private readonly provenance: ProvenanceService) {}

  @Get(':contentId/provenance')
  async read(
    @Param('contentId') contentId: string,
    @Headers('x-request-id') requestId: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ProvenanceView> {
    // Errors keep this header; a success replaces it.
    response.setHeader('Cache-Control', NO_STORE);
    const view = await this.provenance.read(contentId, { requestId });
    response.setHeader('Cache-Control', cacheControlOf(view));
    return view;
  }
}
