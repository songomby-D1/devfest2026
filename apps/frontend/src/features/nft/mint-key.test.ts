import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearMintKey, getOrCreateMintKey, newMintKey } from './mint-key';

afterEach(() => {
  window.sessionStorage.clear();
});

describe('mint idempotency key', () => {
  it('matches the gateway pattern', () => {
    expect(newMintKey()).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
  });

  it('is created once per item and reused until cleared', () => {
    const first = getOrCreateMintKey('item-a');
    expect(getOrCreateMintKey('item-a')).toBe(first);
    expect(getOrCreateMintKey('item-b')).not.toBe(first);
    expect(window.sessionStorage.getItem('lova:mint-key:item-a')).toBe(first);

    clearMintKey('item-a');
    expect(getOrCreateMintKey('item-a')).not.toBe(first);
  });

  it('replaces a stored value that the gateway would refuse', () => {
    window.sessionStorage.setItem('lova:mint-key:item-a', 'short');
    expect(
      getOrCreateMintKey('item-a', window.sessionStorage, () => 'k'.repeat(20)),
    ).toBe('k'.repeat(20));
  });

  it('keeps reusing the key in memory when storage throws', () => {
    const broken = {
      getItem: vi.fn(() => {
        throw new Error('denied');
      }),
      setItem: vi.fn(() => {
        throw new Error('denied');
      }),
      removeItem: vi.fn(),
    };
    const first = getOrCreateMintKey('item-c', broken);
    expect(getOrCreateMintKey('item-c', broken)).toBe(first);
    clearMintKey('item-c', broken);
    expect(getOrCreateMintKey('item-c', broken)).not.toBe(first);
  });
});
