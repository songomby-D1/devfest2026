import type { Model3dDescriptor } from '@devfest2026/shared';
import { z } from 'zod';

/** Delivery URLs must stay on the gateway so that object keys and hosts never reach the browser. */
const gatewayPath = z
  .string()
  .regex(/^\/api\/[A-Za-z0-9._~/-]+$/)
  .refine((path) => !path.split('/').includes('..'));

const variant = z.object({ url: gatewayPath });

/** LiDAR display contract (docs/api/lidar.yaml). */
const lidarDisplaySchema = z.union([
  z.object({
    contentId: z.string(),
    status: z.literal('ready'),
    variants: z.object({ '1k': variant, '2k': variant }),
    poster: variant,
  }),
  z.object({
    contentId: z.string(),
    status: z.enum(['pending', 'processing']),
  }),
  z.object({ contentId: z.string(), status: z.literal('none') }),
]);

/** Maps the LiDAR answer to the frozen 3D descriptor, or returns null when it is malformed. */
export function toModel3dDescriptor(
  contentId: string,
  lidarBody: unknown,
): Model3dDescriptor | null {
  const parsed = lidarDisplaySchema.safeParse(lidarBody);
  if (!parsed.success) return null;
  const display = parsed.data;
  switch (display.status) {
    case 'ready':
      return {
        contentId,
        status: 'ready',
        variants: {
          poster: display.poster.url,
          glb1k: display.variants['1k'].url,
          glb2k: display.variants['2k'].url,
        },
      };
    case 'pending':
    case 'processing':
      return { contentId, status: 'processing', variants: null };
    case 'none':
      return missingModel(contentId);
  }
}

export function missingModel(contentId: string): Model3dDescriptor {
  return { contentId, status: 'missing', variants: null };
}
