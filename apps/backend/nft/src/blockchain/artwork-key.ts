import type { Hex } from 'viem' with { 'resolution-mode': 'import' };
import { viem } from './viem';

/**
 * `artworkKey` of a Content item: keccak256 of the UTF-8 bytes of the
 * lowercase ContentId (nft_context.md §8.3, same as `ethers.id`). The same
 * item always gets the same key whatever the case received, so the
 * contract's one-token-per-key rule (invariant I1) holds per ContentId.
 * Only this hash goes on-chain, never the account of the requester.
 */
export function artworkKeyOf(contentId: string): Hex {
  return viem.keccak256(viem.stringToHex(contentId.toLowerCase()));
}
