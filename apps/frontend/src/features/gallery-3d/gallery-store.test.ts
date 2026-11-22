import { beforeEach, describe, expect, it } from 'vitest';
import { ZOOM_LEVELS } from './gallery-layout';
import {
  currentZoom,
  galleryStore,
  moveRail,
  rail,
  railTo,
  setRailBounds,
} from './gallery-store';

describe('galleryStore phases', () => {
  beforeEach(() => {
    galleryStore.reset();
  });

  it('starts at the entrance and only enters once', () => {
    expect(galleryStore.getState().phase).toBe('entrance');
    galleryStore.enter(1000);
    expect(galleryStore.getState().phase).toBe('entering');
    expect(galleryStore.getState().introStartedAt).toBe(1000);
    galleryStore.enter(2000);
    expect(galleryStore.getState().introStartedAt).toBe(1000);
  });

  it('cannot focus a work before the visit has started', () => {
    galleryStore.focus(2);
    expect(galleryStore.getState().phase).toBe('entrance');
    galleryStore.enter();
    galleryStore.focus(2);
    expect(galleryStore.getState().phase).toBe('entering');
  });

  it('focuses and returns to the visit', () => {
    galleryStore.enter();
    galleryStore.introDone();
    galleryStore.focus(3);
    expect(galleryStore.getState()).toMatchObject({
      phase: 'focus',
      focusedIndex: 3,
      activeIndex: 3,
      zoomLevel: 0,
      inspecting: false,
    });
    galleryStore.unfocus();
    expect(galleryStore.getState()).toMatchObject({
      phase: 'visiting',
      focusedIndex: null,
    });
  });

  it('cycles the zoom and allows inspection only in focus', () => {
    galleryStore.enter();
    galleryStore.introDone();
    galleryStore.zoomStep();
    galleryStore.toggleInspect();
    expect(galleryStore.getState()).toMatchObject({
      zoomLevel: 0,
      inspecting: false,
    });

    galleryStore.focus(0);
    galleryStore.zoomStep();
    expect(currentZoom(galleryStore.getState().zoomLevel)).toBe(ZOOM_LEVELS[1]);
    for (let i = 1; i < ZOOM_LEVELS.length; i += 1) {
      galleryStore.zoomStep();
    }
    expect(galleryStore.getState().zoomLevel).toBe(0);
    galleryStore.zoomOut();
    expect(galleryStore.getState().zoomLevel).toBe(0);

    galleryStore.toggleInspect();
    expect(galleryStore.getState().inspecting).toBe(true);
    galleryStore.focus(1);
    expect(galleryStore.getState().inspecting).toBe(false);
  });

  it('returns to the entrance and keeps the media cache', () => {
    galleryStore.setMediaStatus('radama1', 'ready');
    galleryStore.enter();
    galleryStore.introDone();
    galleryStore.leave();
    expect(galleryStore.getState().phase).toBe('entrance');
    expect(galleryStore.getState().media).toEqual({ radama1: 'ready' });
  });

  it('notifies subscribers once per change', () => {
    let calls = 0;
    const unsubscribe = galleryStore.subscribe(() => {
      calls += 1;
    });
    galleryStore.setActive(2);
    galleryStore.setActive(2);
    galleryStore.setHovered(1);
    galleryStore.setHovered(1);
    expect(calls).toBe(2);
    unsubscribe();
    galleryStore.setActive(4);
    expect(calls).toBe(2);
  });
});

describe('rail', () => {
  beforeEach(() => {
    galleryStore.reset();
    setRailBounds(2, 20);
  });

  it('clamps movement to the room', () => {
    railTo(50);
    expect(rail.target).toBe(20);
    moveRail(-100);
    expect(rail.target).toBe(2);
    moveRail(3.5);
    expect(rail.target).toBe(5.5);
  });

  it('re-clamps the current position when the bounds shrink', () => {
    railTo(18);
    rail.current = 18;
    setRailBounds(2, 10);
    expect(rail.target).toBe(10);
    expect(rail.current).toBe(10);
  });
});
