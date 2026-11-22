import type { CallerContext } from '../../src/common/caller-context';
import type { AppConfig } from '../../src/config/app-config';
import { InboundTokens } from '../../src/config/app-config';

export const OWNER_ID = '6f1c1d1e-2a3b-4c5d-8e9f-0a1b2c3d4e5f';
export const OTHER_ID = '7a2b3c4d-5e6f-4a1b-9c2d-3e4f5a6b7c8d';
export const REVIEWER_ID = '8b3c4d5e-6f7a-4b2c-8d3e-4f5a6b7c8d9e';

export const GATEWAY_TOKEN = 'gateway-to-content-token-0123456789abcdef';
export const NFT_TOKEN = 'nft-to-content-token-0123456789abcdef0123';

export function testConfig(
  databaseUrl = 'postgresql://unused@localhost/content',
): AppConfig {
  return {
    port: 0,
    databaseUrl,
    inboundTokens: new InboundTokens({
      gateway: GATEWAY_TOKEN,
      nft: NFT_TOKEN,
    }),
  };
}

export function callerOf(
  userId: string | null,
  permissions: CallerContext['permissions'] = [],
): CallerContext {
  return { userId, permissions, requestId: 'req-test' };
}

export const GUEST = callerOf(null);
export const OWNER = callerOf(OWNER_ID);
export const OTHER = callerOf(OTHER_ID);
export const REVIEWER = callerOf(REVIEWER_ID, ['reviewer']);

/** A valid CreateItemRequest body. */
export function createBody(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    title: 'Lamba mena',
    kind: 'textile',
    description: 'A silk burial shroud woven in the highlands.',
    creatorName: 'Rasoa',
    creatorCommunity: 'Merina weavers',
    technique: 'Hand-woven silk',
    origin: 'Arivonimamo',
    period: 'Early 20th century',
    rightsStatement: 'Photographed by the contributor, who holds the rights.',
    rightsConfirmed: true,
    ...overrides,
  };
}
