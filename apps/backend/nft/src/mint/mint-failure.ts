/**
 * Failure codes stored on a mint request, with the safe sentence shown to
 * the owner as `failureReason`. Codes stay internal; reasons never contain
 * RPC detail, keys or addresses.
 */
export const MINT_FAILURES = {
  /** `safeMint` reverted for another reason than an existing token. */
  CONTRACT_REVERTED: 'The certificate contract refused this mint.',
  /** The gallery wallet cannot pay the gas. */
  INSUFFICIENT_FUNDS:
    'The gallery cannot pay the network fee right now. Try again later.',
  /** The RPC stayed unreachable for every attempt. */
  CHAIN_UNAVAILABLE:
    'The blockchain network could not be reached. Try again later.',
  /** The metadata could not be prepared or pinned for every attempt. */
  METADATA_UNAVAILABLE:
    'The certificate details could not be published. Try again later.',
  /** The prepared metadata breaks a contract rule (title, hash, category). */
  INVALID_METADATA: 'This item cannot be written into a certificate.',
  UNKNOWN: 'The certificate could not be created. Try again later.',
} as const;

export type MintFailureCode = keyof typeof MINT_FAILURES;

/** Codes that end a request at once; the others are retried. */
export const FINAL_FAILURES: ReadonlySet<MintFailureCode> = new Set([
  'CONTRACT_REVERTED',
  'INSUFFICIENT_FUNDS',
  'INVALID_METADATA',
]);

export function failureReasonOf(code: string | null): string | null {
  if (code === null) return null;
  return code in MINT_FAILURES
    ? MINT_FAILURES[code as MintFailureCode]
    : MINT_FAILURES.UNKNOWN;
}
