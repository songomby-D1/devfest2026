import { describe, expect, it } from 'vitest';
import { toModel3d } from './model3d-adapter';

const ID = 'c1';

describe('toModel3d', () => {
  it('keeps the frozen descriptor', () => {
    const body = {
      contentId: ID,
      status: 'ready',
      variants: { poster: '/api/p', glb1k: '/api/a', glb2k: '/api/b' },
    };
    expect(toModel3d(ID, body)).toEqual(body);
  });

  it('maps the LiDAR display shape (variants 1k/2k, poster.url)', () => {
    expect(
      toModel3d(ID, {
        contentId: ID,
        status: 'ready',
        variants: {
          '1k': { url: '/api/lidar/files/x/1k', bytes: 1 },
          '2k': { url: '/api/lidar/files/x/2k', bytes: 2 },
        },
        poster: { url: '/api/lidar/files/x/poster' },
        ar: null,
      }),
    ).toEqual({
      contentId: ID,
      status: 'ready',
      variants: {
        poster: '/api/lidar/files/x/poster',
        glb1k: '/api/lidar/files/x/1k',
        glb2k: '/api/lidar/files/x/2k',
      },
    });
  });

  it.each([
    [{ status: 'none' }, 'missing'],
    [{ status: 'missing', variants: null }, 'missing'],
    [{ status: 'pending' }, 'processing'],
    [{ status: 'processing', variants: null }, 'processing'],
    [{ status: 'exploded' }, 'missing'],
    [null, 'missing'],
  ])('maps %j to %s', (body, status) => {
    expect(toModel3d(ID, body)).toEqual({ contentId: ID, status, variants: null });
  });

  it('treats a ready body with an off-origin or incomplete URL as missing', () => {
    for (const poster of ['https://evil.example/p', '//evil.example/p', '/api/../p']) {
      expect(
        toModel3d(ID, {
          status: 'ready',
          variants: { poster, glb1k: '/api/a', glb2k: '/api/b' },
        }).status,
      ).toBe('missing');
    }
    expect(
      toModel3d(ID, { status: 'ready', variants: { poster: '/api/p', glb1k: '/api/a' } })
        .status,
    ).toBe('missing');
  });
});
