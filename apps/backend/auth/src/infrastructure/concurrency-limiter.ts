export class LimiterTimeoutError extends Error {
  constructor() {
    super('Timed out waiting for a free slot');
    this.name = 'LimiterTimeoutError';
  }
}

interface Waiter {
  readonly resolve: () => void;
  readonly timer: NodeJS.Timeout;
}

/** Bounds concurrent work and rejects callers that wait longer than `maxWaitMs`. */
export class ConcurrencyLimiter {
  private active = 0;
  private readonly waiters: Waiter[] = [];

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxWaitMs: number,
  ) {
    if (maxConcurrent < 1) throw new RangeError('maxConcurrent must be >= 1');
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active += 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const waiter: Waiter = {
        resolve,
        timer: setTimeout(() => {
          const index = this.waiters.indexOf(waiter);
          if (index !== -1) this.waiters.splice(index, 1);
          reject(new LimiterTimeoutError());
        }, this.maxWaitMs),
      };
      this.waiters.push(waiter);
    });
  }

  private release(): void {
    const next = this.waiters.shift();
    if (next === undefined) {
      this.active -= 1;
      return;
    }
    clearTimeout(next.timer);
    next.resolve();
  }
}
