import { describe, expect, it } from 'vitest';
import { isWebGLAvailable } from './webgl';

function canvasReturning(
  contexts: Record<string, object | null>,
): () => HTMLCanvasElement {
  return () =>
    ({
      getContext: (id: string) => contexts[id] ?? null,
    }) as unknown as HTMLCanvasElement;
}

describe('isWebGLAvailable', () => {
  it('accepts WebGL 2', () => {
    expect(isWebGLAvailable(canvasReturning({ webgl2: {} }))).toBe(true);
  });

  it('falls back to WebGL 1', () => {
    expect(isWebGLAvailable(canvasReturning({ webgl: {} }))).toBe(true);
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
