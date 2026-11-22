import type { MediaKind } from './contract';

const MIB = 1024 * 1024;

/**
 * Upload limits of the Content service defaults (D18 proposal, see
 * apps/backend/content/src/media/media-format.ts and config/app-config.ts).
 * They are hints only: the service checks the file signature and the size
 * again and answers 413 or 415.
 */
export const MEDIA_UPLOAD_LIMITS = {
  image: {
    types: ['image/jpeg', 'image/png', 'image/webp'],
    maxBytes: 12 * MIB,
  },
  video: { types: ['video/mp4', 'video/webm'], maxBytes: 50 * MIB },
  maxPerItem: 10,
  captionMax: 300,
} as const;

export const ACCEPTED_MEDIA_TYPES: readonly string[] = [
  ...MEDIA_UPLOAD_LIMITS.image.types,
  ...MEDIA_UPLOAD_LIMITS.video.types,
];

export function formatMegabytes(bytes: number): string {
  return `${String(Math.round(bytes / MIB))} Mo`;
}

export type MediaCheck =
  | { ok: true; kind: MediaKind }
  | { ok: false; reason: 'type' | 'empty' | 'size'; message: string };

/** Checks a file against the accepted formats and size limits before upload. */
export function checkMediaFile(file: { type: string; size: number }): MediaCheck {
  const type = file.type.toLowerCase();
  const kind: MediaKind | null = (
    MEDIA_UPLOAD_LIMITS.image.types as readonly string[]
  ).includes(type)
    ? 'image'
    : (MEDIA_UPLOAD_LIMITS.video.types as readonly string[]).includes(type)
      ? 'video'
      : null;
  if (kind === null) {
    return {
      ok: false,
      reason: 'type',
      message:
        'Format non accepté. Choisissez une image JPEG, PNG ou WebP, ou une vidéo MP4 ou WebM.',
    };
  }
  if (file.size === 0) {
    return { ok: false, reason: 'empty', message: 'Le fichier est vide.' };
  }
  const max = MEDIA_UPLOAD_LIMITS[kind].maxBytes;
  if (file.size > max) {
    return {
      ok: false,
      reason: 'size',
      message: `Fichier trop lourd : ${kind === 'image' ? 'une image' : 'une vidéo'} ne dépasse pas ${formatMegabytes(max)}.`,
    };
  }
  return { ok: true, kind };
}
