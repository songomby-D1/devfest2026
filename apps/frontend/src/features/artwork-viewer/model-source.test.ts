import { describe, expect, it } from 'vitest';
import { modelSource } from './model-source';

describe('modelSource', () => {
  it('keeps the URL on the first attempt', () => {
    expect(modelSource('/a/model.glb', 0)).toBe('/a/model.glb');
  });

  it('adds a retry fragment on later attempts', () => {
    expect(modelSource('/a/model.glb', 2)).toBe('/a/model.glb#retry-2');
  });

  it('replaces an existing fragment', () => {
    expect(modelSource('/a/model.glb#view', 1)).toBe('/a/model.glb#retry-1');
  });
});
