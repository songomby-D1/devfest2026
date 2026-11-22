import { describe, expect, it } from 'vitest';
import {
  isSessionActive,
  sessionExpiry,
  shouldTouch,
  type SessionLimits,
} from './session-policy.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const limits: SessionLimits = { idleMs: 2 * HOUR, absoluteMs: 7 * DAY };
const createdAt = new Date('2026-11-21T08:00:00.000Z');

function at(offsetMs: number): Date {
  return new Date(createdAt.getTime() + offsetMs);
}

describe('session policy', () => {
  it('keeps a session idle for 1 h 59 active (CA7)', () => {
    const session = { createdAt, lastSeenAt: createdAt, revokedAt: null };
    expect(isSessionActive(session, at(HOUR + 59 * MINUTE), limits)).toBe(true);
  });

  it('ends a session idle for 2 h 01 (CA7)', () => {
    const session = { createdAt, lastSeenAt: createdAt, revokedAt: null };
    expect(isSessionActive(session, at(2 * HOUR + MINUTE), limits)).toBe(false);
  });

  it('ends a session used continuously after 7 days (CA8)', () => {
    const lastSeenAt = at(7 * DAY - MINUTE);
    const session = { createdAt, lastSeenAt, revokedAt: null };
    expect(isSessionActive(session, at(7 * DAY - 30_000), limits)).toBe(true);
    expect(isSessionActive(session, at(7 * DAY), limits)).toBe(false);
  });

  it('reports the earlier of the idle and absolute deadlines', () => {
    expect(sessionExpiry({ createdAt, lastSeenAt: createdAt }, limits)).toEqual(
      at(2 * HOUR),
    );
    expect(
      sessionExpiry({ createdAt, lastSeenAt: at(7 * DAY - HOUR) }, limits),
    ).toEqual(at(7 * DAY));
  });

  it('treats a revoked session as inactive (CA9)', () => {
    const session = { createdAt, lastSeenAt: createdAt, revokedAt: at(MINUTE) };
    expect(isSessionActive(session, at(2 * MINUTE), limits)).toBe(false);
  });

  it('writes lastSeenAt at most once per minute', () => {
    expect(shouldTouch(createdAt, at(59_999))).toBe(false);
    expect(shouldTouch(createdAt, at(MINUTE))).toBe(true);
  });
});
