/**
 * Media formats accepted for upload (D18: the Content owner proposes the
 * permitted formats). Each one plays or displays natively in current desktop
 * and mobile browsers through `<img>` or `<video>`, and has a fixed file
 * signature that can be checked on the first bytes:
 *
 * - JPEG, PNG and WebP cover photographs and scans.
 * - MP4 (ISO base media, H.264 or similar) and WebM (Matroska subset) cover
 *   short demo videos.
 *
 * Deliberately left out: SVG (can carry scripts), GIF (heavy and animated),
 * HEIC (no browser support outside Safari), AVIF and QuickTime MOV (support
 * varies, and their ISO containers need deeper brand checks), and every
 * archive or document type.
 */
export const MEDIA_KINDS = ['image', 'video'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const MEDIA_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

/** Bytes read from the start of a file before the signature is checked. */
export const SIGNATURE_BYTES = 64;

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const EBML_MAGIC = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
/**
 * MP4 major brands accepted in the `ftyp` box. QuickTime (`qt  `) and image
 * brands such as `heic`, `mif1` or `avif` share the container and are refused.
 */
const MP4_BRANDS = new Set([
  'isom',
  'iso2',
  'iso3',
  'iso4',
  'iso5',
  'iso6',
  'iso7',
  'iso8',
  'iso9',
  'mp41',
  'mp42',
  'avc1',
  'dash',
  'mmp4',
  'M4V ',
]);

const SIGNATURES: Readonly<Record<MediaType, (head: Buffer) => boolean>> = {
  // Start of image marker followed by another marker.
  'image/jpeg': (head) =>
    head.length >= 3 &&
    head[0] === 0xff &&
    head[1] === 0xd8 &&
    head[2] === 0xff,
  'image/png': (head) =>
    head.length >= 8 && head.subarray(0, 8).equals(PNG_MAGIC),
  // RIFF container whose form type is "WEBP".
  'image/webp': (head) =>
    head.length >= 12 &&
    head.toString('latin1', 0, 4) === 'RIFF' &&
    head.toString('latin1', 8, 12) === 'WEBP',
  // An `ftyp` box first, with an MP4 major brand.
  'video/mp4': (head) =>
    head.length >= 12 &&
    head.toString('latin1', 4, 8) === 'ftyp' &&
    MP4_BRANDS.has(head.toString('latin1', 8, 12)),
  // EBML header whose DocType is "webm" (it sits within the first bytes).
  'video/webm': (head) =>
    head.length >= 4 &&
    head.subarray(0, 4).equals(EBML_MAGIC) &&
    head.includes('webm', 4, 'latin1'),
};

export function isMediaType(value: string): value is MediaType {
  return (MEDIA_TYPES as readonly string[]).includes(value);
}

export function kindOf(type: MediaType): MediaKind {
  return type.startsWith('image/') ? 'image' : 'video';
}

/** Normalizes a declared Content-Type: lower case, without parameters. */
export function normalizeType(declared: string | undefined): string {
  return (declared?.split(';')[0] ?? '').trim().toLowerCase();
}

/** True when the first bytes of a file match the signature of its declared type. */
export function matchesSignature(type: MediaType, head: Buffer): boolean {
  return SIGNATURES[type](head);
}
