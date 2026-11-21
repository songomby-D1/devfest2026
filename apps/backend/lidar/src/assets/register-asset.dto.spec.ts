import { describe, expect, it } from 'vitest';
import { registerAssetSchema } from './register-asset.dto.js';

const validBody = {
  contentId: '0b8f6c1e-4a52-4d36-9f4c-3c1f2a7e9d10',
  objectKey1k: 'lidar/items/abc/model-1k.glb',
  objectKey2k: 'lidar/items/abc/model-2k.glb',
  posterKey: 'lidar/items/abc/poster.webp',
  size1kBytes: 74_000,
  size2kBytes: 148_000,
  posterBytes: 12_000,
};

describe('registerAssetSchema', () => {
  it('accepts a valid body and applies defaults', () => {
    expect(registerAssetSchema.parse(validBody)).toEqual({
      ...validBody,
      usdzKey: null,
      status: 'ready',
    });
  });

  it.each([
    ['contentId', 'not-a-uuid'],
    ['contentId', undefined],
    ['objectKey1k', '../etc/passwd'],
    ['objectKey2k', 'lidar/../other'],
    ['posterKey', '/absolute/poster.webp'],
    ['posterKey', ''],
    ['usdzKey', 'lidar/a..b.usdz'],
    ['size1kBytes', 0],
    ['size2kBytes', -1],
    ['posterBytes', 1.5],
    ['posterBytes', '12000'],
    ['size1kBytes', 2_147_483_648],
    ['status', 'deleted'],
  ])('rejects %s = %j', (field, value) => {
    expect(
      registerAssetSchema.safeParse({ ...validBody, [field]: value }).success,
    ).toBe(false);
  });

  it('rejects unknown fields', () => {
    expect(
      registerAssetSchema.safeParse({ ...validBody, id: 'forced-id' }).success,
    ).toBe(false);
  });
});
