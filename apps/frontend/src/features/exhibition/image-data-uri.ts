/*
 * Photos are resized and re-encoded in the browser before upload: Meshy only
 * needs a clear view of the object, and the gateway accepts small bodies.
 */

export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
/** LiDAR refuses decoded images above 1.4 MB; keep a margin. */
export const MAX_ENCODED_BYTES = 1_300_000;
const MAX_SIDE = 1280;
const QUALITIES = [0.88, 0.8, 0.7, 0.6, 0.5] as const;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

export class ImagePreparationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImagePreparationError';
  }
}

/** Decoded size of a base64 data URI, in bytes. */
export function dataUriBytes(dataUri: string): number {
  const base64 = dataUri.slice(dataUri.indexOf(',') + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/** Width and height that fit within `maxSide`, keeping the ratio. */
export function fitWithin(
  width: number,
  height: number,
  maxSide = MAX_SIDE,
): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function checkSourceImage(file: File): string | null {
  if (!ACCEPTED.includes(file.type)) {
    return 'Choisissez une photo JPEG, PNG ou WebP.';
  }
  if (file.size > MAX_SOURCE_BYTES) {
    return 'Cette photo dépasse 25 Mo. Choisissez une image plus légère.';
  }
  return null;
}

/** Re-encodes the photo as a JPEG data URI under the upload limit. */
export async function toUploadDataUri(file: File): Promise<string> {
  const problem = checkSourceImage(file);
  if (problem !== null) throw new ImagePreparationError(problem);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImagePreparationError('Cette image ne peut pas être lue.');
  }
  const size = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (context === null) {
    bitmap.close();
    throw new ImagePreparationError('Cette image ne peut pas être préparée.');
  }
  // JPEG has no alpha: a white ground keeps transparent PNG cut-outs clean.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size.width, size.height);
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();

  for (const quality of QUALITIES) {
    const dataUri = canvas.toDataURL('image/jpeg', quality);
    if (dataUriBytes(dataUri) <= MAX_ENCODED_BYTES) return dataUri;
  }
  throw new ImagePreparationError(
    'Cette image reste trop lourde. Essayez une autre photo.',
  );
}
