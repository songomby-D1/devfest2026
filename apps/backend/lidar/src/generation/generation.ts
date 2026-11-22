import { z } from 'zod';

/** Public base path of generation routes on the gateway. */
export const GENERATION_PUBLIC_BASE_PATH = '/api/generations';

export type GenerationStatus =
  'queued' | 'modeling' | 'storing' | 'ready' | 'failed';

export type GenerationErrorCode =
  'GENERATION_REJECTED' | 'GENERATION_FAILED' | 'GENERATION_EXPIRED';

/** Body of `GET /internal/v1/generations/:id`, relayed as-is by the gateway. */
export interface GenerationView {
  readonly id: string;
  readonly title: string;
  readonly status: GenerationStatus;
  /** 0 to 100, over the whole generation including storage. */
  readonly progress: number;
  /** Gateway path of the GLB once `ready`. */
  readonly modelUrl: string | null;
  /** Gateway path of Meshy's preview image once `ready`, when Meshy produced one. */
  readonly posterUrl: string | null;
  readonly errorCode: GenerationErrorCode | null;
  readonly createdAt: string;
}

/** Decoded images are capped well below Meshy's 20 MB so the gateway JSON limit holds. */
export const MAX_IMAGE_BYTES = 1_400_000;
const MAX_DATA_URI_LENGTH = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 64;

const DATA_URI = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

export const createGenerationSchema = z
  .object({
    image: z.string().max(MAX_DATA_URI_LENGTH).regex(DATA_URI),
    title: z.string().trim().min(1).max(120).optional(),
    texturePrompt: z.string().trim().max(600).optional(),
  })
  .strict();

export type CreateGenerationDto = z.output<typeof createGenerationSchema>;

export const generationIdSchema = z.uuid();

type ImageType = 'jpeg' | 'png' | 'webp';

const SIGNATURES: Readonly<Record<ImageType, (head: Buffer) => boolean>> = {
  jpeg: (head) => head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff,
  png: (head) => head.readUInt32BE(0) === 0x89504e47,
  webp: (head) =>
    head.toString('latin1', 0, 4) === 'RIFF' &&
    head.toString('latin1', 8, 12) === 'WEBP',
};

/** Checks that the data URI decodes to an image of its declared type and size. */
export function isAcceptedImage(dataUri: string): boolean {
  const match = DATA_URI.exec(dataUri);
  if (match === null) return false;
  const type = match[1] as ImageType;
  const bytes = Buffer.from(match[2] ?? '', 'base64');
  if (bytes.length < 12 || bytes.length > MAX_IMAGE_BYTES) return false;
  return SIGNATURES[type](bytes);
}
