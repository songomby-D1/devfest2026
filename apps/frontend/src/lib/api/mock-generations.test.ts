import { describe, expect, it } from 'vitest';
import { ApiError } from './client';
import { createMockGenerations, MOCK_GENERATION_MS } from './mock-generations';

const IMAGE = 'data:image/jpeg;base64,/9j/AAAA';

function setup(userId: string | null = 'user-1') {
  let now = 0;
  let id = 0;
  let user = userId;
  const handlers = createMockGenerations({
    requireUserId: () => {
      if (user === null) {
        throw new ApiError(401, {
          code: 'UNAUTHENTICATED',
          message: 'Sign in',
          requestId: 'r',
        });
      }
      return user;
    },
    respond: (produce) =>
      new Promise((resolve) => {
        resolve(produce());
      }),
    nextRequestId: () => 'r',
    createId: () => `g-${String((id += 1))}`,
    now: () => now,
  });
  return {
    handlers,
    advance: (ms: number) => {
      now += ms;
    },
    signInAs: (next: string | null) => {
      user = next;
    },
  };
}

describe('mock image-to-3D generations', () => {
  it('refuses a guest', async () => {
    const { handlers } = setup(null);
    await expect(
      handlers.createGeneration({ image: IMAGE }),
    ).rejects.toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
  });

  it('refuses a body that is not an image data URI', async () => {
    const { handlers } = setup();
    await expect(
      handlers.createGeneration({ image: 'https://example.org/a.jpg' }),
    ).rejects.toMatchObject({ status: 400, code: 'IMAGE_INVALID' });
  });

  it('progresses with time, then serves a model', async () => {
    const { handlers, advance } = setup();
    const created = await handlers.createGeneration({
      image: IMAGE,
      title: 'Sobika',
    });
    expect(created).toMatchObject({
      status: 'queued',
      progress: 0,
      modelUrl: null,
    });

    advance(MOCK_GENERATION_MS / 2);
    expect(await handlers.getGeneration(created.id)).toMatchObject({
      status: 'modeling',
      progress: 50,
    });

    advance(MOCK_GENERATION_MS);
    const ready = await handlers.getGeneration(created.id);
    expect(ready.status).toBe('ready');
    expect(ready.modelUrl).toMatch(/\.glb$/);
  });

  it('hides a generation from another visitor', async () => {
    const { handlers, signInAs } = setup();
    const created = await handlers.createGeneration({ image: IMAGE });
    signInAs('user-2');
    await expect(handlers.getGeneration(created.id)).rejects.toMatchObject({
      status: 404,
    });
    expect(await handlers.listGenerations()).toEqual([]);
  });
});
