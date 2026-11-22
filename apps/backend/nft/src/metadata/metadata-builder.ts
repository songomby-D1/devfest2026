import type { ItemSnapshot, SnapshotMedia } from './content-snapshot-client';
import type { ContractCategory } from './metadata-publisher.port';

/** `PreservingArt.MAX_TITLE_BYTES`. */
export const MAX_TITLE_BYTES = 256;

/**
 * [PROPOSED] Content `kind` → contract `Category`. `painting` and
 * `sculpture` map one to one; every other kind (`photograph`, `textile`,
 * `object`, `other`, and any kind Content adds later) maps to `Craft`.
 * Owner decision: salandri-42 (contract) and papangoo (Content kinds).
 */
export function toContractCategory(kind: string): ContractCategory {
  switch (kind) {
    case 'painting':
      return 'Painting';
    case 'sculpture':
      return 'Sculpture';
    default:
      return 'Craft';
  }
}

const graphemes = new Intl.Segmenter('en', { granularity: 'grapheme' });
const encoder = new TextEncoder();

/**
 * Cuts `text` to at most `maxBytes` UTF-8 bytes on a grapheme boundary, so
 * no character, combining mark or emoji sequence is split. The full title
 * stays in the metadata `name`; only the on-chain label is shortened.
 */
export function truncateUtf8(text: string, maxBytes: number): string {
  if (encoder.encode(text).length <= maxBytes) return text;
  let result = '';
  let used = 0;
  for (const { segment } of graphemes.segment(text)) {
    const size = encoder.encode(segment).length;
    if (used + size > maxBytes) break;
    result += segment;
    used += size;
  }
  return result;
}

/**
 * The master file whose sha256 goes on-chain: the first image in Content's
 * media order (the item's display order, whose first image is also its
 * thumbnail), otherwise the first video, otherwise none.
 */
export function chooseMaster(
  media: readonly SnapshotMedia[],
): SnapshotMedia | null {
  return (
    media.find((file) => file.kind === 'image') ??
    media.find((file) => file.kind === 'video') ??
    null
  );
}

export interface MetadataAttribute {
  readonly trait_type: string;
  readonly value: string;
}

export interface PublicMetadataFile {
  readonly uri: string;
  readonly type: string;
  readonly role: 'preview';
}

/** ERC-721 metadata JSON (EIP-721 "metadata JSON schema" + OpenSea fields). */
export interface PublicMetadata {
  readonly name: string;
  readonly description: string;
  readonly image?: string;
  readonly attributes: readonly MetadataAttribute[];
  readonly properties: {
    readonly contentId: string;
    readonly category: ContractCategory;
    readonly kind: string;
    readonly master_sha256: string;
    readonly claims_note: string;
    readonly files: readonly PublicMetadataFile[];
  };
}

export interface MetadataInput {
  readonly item: ItemSnapshot;
  readonly contentId: string;
  readonly category: ContractCategory;
  /** `0x` + 64 hex characters. */
  readonly masterHash: string;
  readonly preview: { readonly cid: string; readonly mimeType: string } | null;
}

/** Human review only: the platform's advisory signals never verify a claim. */
export const CLAIMS_NOTE =
  'Claim statuses record the review by human community reviewers on LOVA ' +
  'when this token was minted: "verified", "uncertain" or "unreviewed" ' +
  '(not reviewed yet). This token records a digital preservation event; it ' +
  'does not certify physical authenticity or ownership of the work.';

function optional(trait: string, value: string | null): MetadataAttribute[] {
  const text = value?.trim() ?? '';
  return text === '' ? [] : [{ trait_type: trait, value: text }];
}

/**
 * Builds the public metadata from an allowlist of public fields. The key
 * order is fixed and nothing time-dependent is included, so the same
 * snapshot always gives the same bytes, hence the same CID.
 */
export function buildMetadata(input: MetadataInput): PublicMetadata {
  const { item, preview } = input;
  const image = preview === null ? undefined : `ipfs://${preview.cid}`;
  return {
    name: item.title.trim(),
    description: item.description,
    ...(image === undefined ? {} : { image }),
    attributes: [
      { trait_type: 'Kind', value: item.kind },
      { trait_type: 'Category', value: input.category },
      ...optional('Creator', item.creator.name),
      ...optional('Community', item.creator.community),
      ...optional('Technique', item.creator.technique),
      ...optional('Origin', item.origin),
      ...optional('Period', item.period),
      { trait_type: 'Item claim', value: item.claims.item },
      { trait_type: 'Description claim', value: item.claims.description },
    ],
    properties: {
      contentId: input.contentId,
      category: input.category,
      kind: item.kind,
      master_sha256: input.masterHash,
      claims_note: CLAIMS_NOTE,
      files:
        image === undefined || preview === null
          ? []
          : [{ uri: image, type: preview.mimeType, role: 'preview' }],
    },
  };
}
