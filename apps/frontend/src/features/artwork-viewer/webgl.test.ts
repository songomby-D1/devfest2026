import { describe, expect, it, vi } from 'vitest';
import { isWebGLAvailable } from './webgl';

function canvasReturning(
  contexts: Record<string, Partial<WebGLRenderingContext> | null>,
): () => HTMLCanvasElement {
  return () =>
    ({
      getContext: (id: string) => contexts[id] ?? null,
    }) as unknown as HTMLCanvasElement;
}

function fakeContext(loseContext = vi.fn()): Partial<WebGLRenderingContext> {
  return {
    getExtension: ((name: string) =>
      name === 'WEBGL_lose_context'
        ? { loseContext }
        : null) as WebGLRenderingContext['getExtension'],
  };
}

describe('isWebGLAvailable', () => {
  it('releases the probe context', () => {
    const loseContext = vi.fn();
    isWebGLAvailable(canvasReturning({ webgl2: fakeContext(loseContext) }));
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it('accepts WebGL 2', () => {
    expect(isWebGLAvailable(canvasReturning({ webgl2: fakeContext() }))).toBe(
      true,
    );
  });

  it('falls back to WebGL 1', () => {
    expect(isWebGLAvailable(canvasReturning({ webgl: fakeContext() }))).toBe(
      true,
    );
  });

  it('reports no WebGL when no context can be created', () => {
    expect(isWebGLAvailable(canvasReturning({}))).toBe(false);
  });

  it('reports no WebGL when context creation throws', () => {
    const throwing = () => {
      throw new Error('blocked');
    };
    expect(isWebGLAvailable(throwing)).toBe(false);
  });
});
