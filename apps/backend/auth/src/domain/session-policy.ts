export interface SessionLimits {
  readonly idleMs: number;
  readonly absoluteMs: number;
}

export interface SessionTimes {
  readonly createdAt: Date;
  readonly lastSeenAt: Date;
  readonly revokedAt: Date | null;
}

/** Introspection writes `lastSeenAt` at most once per interval to limit database writes. */
export const TOUCH_INTERVAL_MS = 60_000;

export function absoluteExpiry(createdAt: Date, limits: SessionLimits): Date {
  return new Date(createdAt.getTime() + limits.absoluteMs);
}

/** The earlier of the idle and absolute deadlines. */
export function sessionExpiry(
  session: Pick<SessionTimes, 'createdAt' | 'lastSeenAt'>,
  limits: SessionLimits,
): Date {
  return new Date(
    Math.min(
      session.lastSeenAt.getTime() + limits.idleMs,
      session.createdAt.getTime() + limits.absoluteMs,
    ),
  );
}

export function isSessionActive(
  session: SessionTimes,
  now: Date,
  limits: SessionLimits,
): boolean {
  return (
    session.revokedAt === null &&
    now.getTime() < sessionExpiry(session, limits).getTime()
  );
}

export function shouldTouch(lastSeenAt: Date, now: Date): boolean {
  return now.getTime() - lastSeenAt.getTime() >= TOUCH_INTERVAL_MS;
}
