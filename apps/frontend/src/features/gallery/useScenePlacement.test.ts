import { describe, expect, it } from 'vitest';
import { computeScenePlacement } from './useScenePlacement';

describe('computeScenePlacement', () => {
  it('matches the Figma placement at 1440x900', () => {
    const placement = computeScenePlacement(1440, 900);

    expect(placement.left).toBeCloseTo(-329);
    expect(placement.top).toBeCloseTo(-56);
    expect(placement.width).toBeCloseTo(1830);
    expect(placement.height).toBeCloseTo(1011);
  });

  it('always covers the viewport', () => {
    for (const [width, height] of [
      [390, 844],
      [1024, 1366],
      [1920, 1080],
      [2560, 1440],
      [3440, 1440],
    ] as const) {
      const placement = computeScenePlacement(width, height);
      expect(placement.left).toBeLessThanOrEqual(0);
      expect(placement.top).toBeLessThanOrEqual(0);
      expect(placement.left + placement.width).toBeGreaterThanOrEqual(width);
      expect(placement.top + placement.height).toBeGreaterThanOrEqual(height);
    }
  });
});
