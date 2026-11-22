import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { setApiClient } from '../lib/api';
import { createMockClient } from '../lib/api/mock-client';
import { ambience } from '../lib/audio/ambience';
import { resetCollection } from '../lib/collection/published-items';
import { resetSession } from '../lib/session/session';

/*
 * jsdom lacks the browser APIs that the pages touch. These stubs make them
 * inert so tests assert behavior, not animation frames.
 */

// <dialog> may be missing in jsdom. The polyfill keeps the open state only.
const dialogPrototype: { showModal?: () => void; close?: () => void } =
  HTMLDialogElement.prototype;
dialogPrototype.showModal ??= function showModal(this: HTMLDialogElement) {
  this.setAttribute('open', '');
};
dialogPrototype.close ??= function close(this: HTMLDialogElement) {
  this.removeAttribute('open');
};

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  // Font loading resolves immediately so intros start right away.
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { load: () => Promise.resolve([]) },
  });

  // HTMLMediaElement has no playback in jsdom. A resolved play() means "allowed".
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() =>
    Promise.resolve(),
  );
  vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(
    () => undefined,
  );

  window.history.replaceState(null, '', '/');

  // Every test talks to a fresh in-memory gateway, signed out.
  setApiClient(createMockClient());
  resetSession();
  resetCollection();
});

afterEach(() => {
  cleanup();
  ambience.reset();
  vi.restoreAllMocks();
  setApiClient(null);
});
