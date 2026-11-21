import { z } from 'zod';

// Opaque content identifier; UUID is assumed until the Content contract (CONTENT-02) is agreed.
export const contentIdSchema = z.uuid();

const MAX_OBJECT_KEY_LENGTH = 512;
const MAX_INT4 = 2_147_483_647;

const objectKeySchema = z
  .string()
  .min(1)
  .max(MAX_OBJECT_KEY_LENGTH)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._/-]*$/,
    'must be a relative key of letters, digits, ".", "_", "-" or "/"',
  )
  .refine((key) => !key.includes('..'), 'must not contain ".."');

const byteSizeSchema = z.number().int().positive().max(MAX_INT4);

export const registerAssetSchema = z.strictObject({
  contentId: contentIdSchema,
  objectKey1k: objectKeySchema,
  objectKey2k: objectKeySchema,
  posterKey: objectKeySchema,
  usdzKey: objectKeySchema.nullable().default(null),
  size1kBytes: byteSizeSchema,
  size2kBytes: byteSizeSchema,
  posterBytes: byteSizeSchema,
  status: z.enum(['pending', 'ready']).default('ready'),
});

export type RegisterAssetDto = z.infer<typeof registerAssetSchema>;
