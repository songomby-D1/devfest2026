import type { ContentId, Model3d } from './contract';

// The gateway maps the LiDAR display answer to the frozen `Model3dDescriptor`
// (apps/backend/gateway/src/proxy/model3d.ts). The LiDAR service itself still
// answers `status: none` and `variants['1k' | '2k']` (docs/api/lidar.yaml,
// #101 review). This adapter accepts both shapes so the panel keeps working if
// a body ever arrives unmapped, and drops any URL that is not same-origin.

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null;
}

/** Same-origin absolute paths only: no scheme, no protocol-relative host. */
function samePath(value: unknown): string | null {
  return typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.split('/').includes('..')
    ? value
    : null;
}

function urlOf(value: unknown): string | null {
  return isObject(value) ? samePath(value.url) : samePath(value);
}

function readyVariants(body: Json): Model3d['variants'] {
  const variants = isObject(body.variants) ? body.variants : {};
  const poster = urlOf(variants.poster) ?? urlOf(body.poster);
  const glb1k = urlOf(variants.glb1k) ?? urlOf(variants['1k']);
  const glb2k = urlOf(variants.glb2k) ?? urlOf(variants['2k']);
  return poster && glb1k && glb2k ? { poster, glb1k, glb2k } : null;
}

/** Turns a model3d body into the frozen descriptor; anything unusable is `missing`. */
export function toModel3d(contentId: ContentId, body: unknown): Model3d {
  const missing: Model3d = { contentId, status: 'missing', variants: null };
  if (!isObject(body)) return missing;
  switch (body.status) {
    case 'ready': {
      const variants = readyVariants(body);
      return variants ? { contentId, status: 'ready', variants } : missing;
    }
    case 'processing':
    case 'pending':
      return { contentId, status: 'processing', variants: null };
    default:
      // `missing`, LiDAR's `none` and unknown values.
      return missing;
  }
}
