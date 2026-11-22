import { describe, expect, it } from 'vitest';
import { InvalidConfigError, loadAppConfig } from './app-config.js';

const valid = {
  DATABASE_URL: 'postgresql://auth_runtime:secret@postgres:5432/auth',
  AUTH_INBOUND_TOKEN_GATEWAY: 'g'.repeat(32),
};

describe('loadAppConfig', () => {
  it('applies the contract defaults: 2 h idle and 7-day absolute sessions', () => {
    const config = loadAppConfig(valid);
    expect(config.port).toBe(3000);
    expect(config.session).toEqual({
      idleMs: 2 * 3600_000,
      absoluteMs: 7 * 86_400_000,
    });
    expect(config.passwordHashing).toEqual({ concurrency: 4, maxWaitMs: 5000 });
  });

  it('names missing or invalid variables without echoing their values', () => {
    try {
      loadAppConfig({
        DATABASE_URL: 'mysql://user:hunter2@db/auth',
        AUTH_INBOUND_TOKEN_GATEWAY: 'short',
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidConfigError);
      const message = (error as Error).message;
      expect(message).toContain('AUTH_INBOUND_TOKEN_GATEWAY');
      expect(message).toContain('DATABASE_URL');
      expect(message).not.toContain('hunter2');
    }
  });
});
