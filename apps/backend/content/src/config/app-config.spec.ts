import { InvalidConfigError, loadAppConfig } from './app-config';

const GATEWAY_TOKEN = 'g'.repeat(40);
const DATABASE_URL =
  'postgresql://content_runtime:secret-password@db:5432/content';

function problemsOf(raw: Record<string, string>): readonly string[] {
  try {
    loadAppConfig(raw);
  } catch (error) {
    if (error instanceof InvalidConfigError) return error.problems;
    throw error;
  }
  throw new Error('Expected the environment to be rejected');
}

describe('loadAppConfig', () => {
  const valid = {
    DATABASE_URL,
    CONTENT_INBOUND_TOKEN_GATEWAY: GATEWAY_TOKEN,
  };

  it('applies defaults and converts the port', () => {
    expect(loadAppConfig(valid).port).toBe(3000);
    expect(loadAppConfig({ ...valid, PORT: '4100' }).port).toBe(4100);
    expect(loadAppConfig({ ...valid, PORT: '' }).port).toBe(3000);
  });

  it('exposes only the configured inbound tokens', () => {
    const config = loadAppConfig({
      ...valid,
      CONTENT_INBOUND_TOKEN_NFT: 'n'.repeat(32),
    });

    expect(config.inboundTokens.tokenFor('gateway')).toBe(GATEWAY_TOKEN);
    expect(config.inboundTokens.tokenFor('nft')).toBe('n'.repeat(32));
    expect(config.inboundTokens.tokenFor('lidar')).toBeUndefined();
  });

  it('never serializes secrets', () => {
    const serialized = JSON.stringify(loadAppConfig(valid));

    expect(serialized).not.toContain(GATEWAY_TOKEN);
  });

  it.each(['DATABASE_URL', 'CONTENT_INBOUND_TOKEN_GATEWAY'])(
    'names the missing variable %s',
    (name) => {
      const { [name as keyof typeof valid]: _removed, ...raw } = valid;

      expect(problemsOf(raw).join('\n')).toContain(`${name} is required`);
    },
  );

  it.each([
    ['PORT', 'abc'],
    ['PORT', '70000'],
    ['DATABASE_URL', 'mysql://db/content'],
    ['CONTENT_INBOUND_TOKEN_GATEWAY', 'too-short'],
    ['CONTENT_INBOUND_TOKEN_LIDAR', 'too-short'],
  ])('rejects %s=%s without echoing the value', (name, value) => {
    const text = problemsOf({ ...valid, [name]: value }).join('\n');

    expect(text).toContain(name);
    expect(text).not.toContain(value);
  });
});
