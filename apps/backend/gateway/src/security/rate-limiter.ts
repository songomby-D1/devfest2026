export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

interface Window {
  count: number;
  readonly resetAt: number;
}

const MAX_TRACKED_KEYS = 10_000;

/** In-memory fixed-window limiter. Enough for one gateway instance on the demo laptop. */
export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  consume(key: string): RateLimitDecision {
    const now = this.now();
    let window = this.windows.get(key);
    if (window === undefined || window.resetAt <= now) {
      this.pruneIfFull(now);
      window = { count: 0, resetAt: now + this.windowMs };
      this.windows.set(key, window);
    }
    window.count += 1;
    return {
      allowed: window.count <= this.limit,
      retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
    };
  }

  private pruneIfFull(now: number): void {
    if (this.windows.size < MAX_TRACKED_KEYS) return;
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
    // Under a flood of distinct keys, forget the oldest entries rather than grow without bound.
    while (this.windows.size >= MAX_TRACKED_KEYS) {
      const oldest = this.windows.keys().next();
      if (oldest.done === true) break;
      this.windows.delete(oldest.value);
    }
  }
}
