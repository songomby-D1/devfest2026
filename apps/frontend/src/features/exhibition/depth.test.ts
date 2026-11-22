import { describe, expect, it } from 'vitest';
import {
  chapterAt,
  clampDepth,
  damp,
  depthLabel,
  keyStep,
  sinkAmount,
  snapIndex,
  stageOffset,
} from './depth';

describe('storyline depth', () => {
  it('clamps the depth to the chapters and rounds to the active one', () => {
    expect(clampDepth(-2, 6)).toBe(0);
    expect(clampDepth(9, 6)).toBe(5);
    expect(chapterAt(2.4, 6)).toBe(2);
    expect(chapterAt(2.6, 6)).toBe(3);
    expect(chapterAt(3, 0)).toBe(0);
  });

  it('advances one chapter for a single wheel notch, in its direction', () => {
    expect(snapIndex(2, 2.24, 6)).toBe(3);
    expect(snapIndex(2, 1.76, 6)).toBe(1);
  });

  it('ignores a nudge below the threshold', () => {
    expect(snapIndex(2, 2.1, 6)).toBe(2);
    expect(snapIndex(2, 1.9, 6)).toBe(2);
  });

  it('keeps a long flick within the storyline', () => {
    expect(snapIndex(1, 3.4, 6)).toBe(3);
    expect(snapIndex(4, 9, 6)).toBe(5);
    expect(snapIndex(1, -3, 6)).toBe(0);
  });

  it('labels each chapter with its distance from the entrance', () => {
    expect(depthLabel(0)).toBe('0 m');
    expect(depthLabel(3)).toBe('−24 m');
  });

  it('moves deeper with down keys and back with up keys, never sideways', () => {
    expect(keyStep('ArrowDown')).toBe(1);
    expect(keyStep('PageDown')).toBe(1);
    expect(keyStep(' ')).toBe(1);
    expect(keyStep('ArrowUp')).toBe(-1);
    expect(keyStep('Home')).toBe('first');
    expect(keyStep('End')).toBe('last');
    expect(keyStep('ArrowRight')).toBeNull();
    expect(keyStep('ArrowLeft')).toBeNull();
  });

  it('sinks a chapter only once the camera walks past it', () => {
    expect(sinkAmount(-1)).toBe(0);
    expect(sinkAmount(0)).toBe(0);
    expect(sinkAmount(0.25)).toBeGreaterThan(0);
    expect(sinkAmount(0.25)).toBeLessThan(1);
    expect(sinkAmount(0.6)).toBe(1);
  });

  it('eases toward the target independently of the frame rate', () => {
    const oneStep = damp(0, 10, 3, 0.1);
    let twoSteps = damp(0, 10, 3, 0.05);
    twoSteps = damp(twoSteps, 10, 3, 0.05);
    expect(oneStep).toBeCloseTo(twoSteps, 10);
  });

  it('moves the models aside only on wide screens', () => {
    expect(stageOffset(16 / 9)).toBeGreaterThan(0);
    expect(stageOffset(9 / 16)).toBe(0);
  });
});
