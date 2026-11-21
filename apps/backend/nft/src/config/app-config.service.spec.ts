import { tmpdir } from 'node:os';
import { ConfigService } from '@nestjs/config';
import { AppConfigService } from './app-config.service';
import type { EnvSchema } from './env.schema';
import { validateEnv } from './env.schema';

const SECRET_KEY = `0x${'22'.repeat(32)}`;
const SECRET_JWT = 'jwt-value-for-tests';

function configFor(overrides: Record<string, string> = {}): AppConfigService {
  const env = validateEnv({
    CONTRACT_ADDRESS: `0x${'ab'.repeat(20)}`,
    MINTER_PRIVATE_KEY: SECRET_KEY,
    PINATA_JWT: SECRET_JWT,
    MEDIA_ROOT: tmpdir(),
    ...overrides,
  });
  return new AppConfigService(new ConfigService<EnvSchema, true>(env));
}

describe('AppConfigService', () => {
  it('exposes typed configuration groups', () => {
    const config = configFor({ PORT: '4000', CHAIN_ID: '31337' });

    expect(config.http).toEqual({ port: 4000 });
    expect(config.chain.chainId).toBe(31337);
    expect(config.ipfs.driver).toBe('pinata');
    expect(config.limits.masterBytes).toBe(2147483648);
    expect(config.mint.maxStalledCount).toBe(3);
  });

  it('keeps secrets out of the configuration groups', () => {
    const config = configFor();
    const groups = JSON.stringify([
      config.http,
      config.media,
      config.chain,
      config.ipfs,
      config.limits,
      config.mint,
      config.devTools,
    ]);

    expect(groups).not.toContain(SECRET_KEY);
    expect(groups).not.toContain(SECRET_JWT);
    expect(config.minterPrivateKey).toBe(SECRET_KEY);
    expect(config.pinataJwt).toBe(SECRET_JWT);
  });

  it('ignores FAULT_INJECT outside NODE_ENV=test', () => {
    expect(
      configFor({ NODE_ENV: 'test', FAULT_INJECT: 'after-tx-send' }).devTools
        .faultInject,
    ).toBe('after-tx-send');
    expect(
      configFor({ NODE_ENV: 'development', FAULT_INJECT: 'after-tx-send' })
        .devTools.faultInject,
    ).toBeUndefined();
  });
});
