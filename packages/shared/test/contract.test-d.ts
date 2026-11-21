import { describe, expectTypeOf, it } from 'vitest';
import type {
  ClaimStatus,
  ItemDetail,
  Model3dDescriptor,
  MintStatus,
  PublicError,
  PublicationStatus,
} from '../src/index.js';

describe('frozen Gate 0 vocabulary', () => {
  it('keeps the publication, claim and mint statuses', () => {
    expectTypeOf<PublicationStatus>().toEqualTypeOf<
      'draft' | 'published' | 'unpublished'
    >();
    expectTypeOf<ClaimStatus>().toEqualTypeOf<
      'unreviewed' | 'verified' | 'uncertain'
    >();
    expectTypeOf<MintStatus>().toEqualTypeOf<
      'pending' | 'confirmed' | 'failed'
    >();
  });

  it('tracks item and description claims separately', () => {
    expectTypeOf<ItemDetail['claims']>().toEqualTypeOf<{
      readonly item: ClaimStatus;
      readonly description: ClaimStatus;
    }>();
  });

  it('exposes the 3D variants only as URLs', () => {
    expectTypeOf<Model3dDescriptor['variants']>().toEqualTypeOf<{
      readonly poster: string;
      readonly glb1k: string;
      readonly glb2k: string;
    } | null>();
  });

  it('keeps the public error shape', () => {
    expectTypeOf<PublicError>().toHaveProperty('code');
    expectTypeOf<PublicError>().toHaveProperty('message');
    expectTypeOf<PublicError>().toHaveProperty('requestId');
  });
});
