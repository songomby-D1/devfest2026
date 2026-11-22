import { inspect } from 'node:util';
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
    STORAGE_ENDPOINT: 'http://seaweedfs:8333',
    STORAGE_BUCKET: 'lova-media',
    STORAGE_ACCESS_KEY_ID: 'content-key-id',
    STORAGE_SECRET_ACCESS_KEY: 'content-secret-value',
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
    const config = loadAppConfig(valid);
    const serialized = JSON.stringify(config);
    const inspected = inspect(config, { depth: 5 });

    expect(serialized).not.toContain(GATEWAY_TOKEN);
    for (const text of [
      serialized,
      inspected,
      String(config.storage.credentials),
    ]) {
      expect(text).not.toContain('content-key-id');
      expect(text).not.toContain('content-secret-value');
    }
  });

  it('applies the storage and media defaults', () => {
    const config = loadAppConfig(valid);

    expect(config.storage).toMatchObject({
      endpoint: 'http://seaweedfs:8333',
      region: 'us-east-1',
      bucket: 'lova-media',
      prefix: 'content/',
      forcePathStyle: true,
    });
    expect(config.storage.credentials.secretAccessKey).toBe(
      'content-secret-value',
    );
    expect(config.media).toEqual({
      maxImageBytes: 12 * 1024 * 1024,
      maxVideoBytes: 50 * 1024 * 1024,
      maxPerItem: 10,
    });
  });

  it('reads the media limits and storage options', () => {
    const config = loadAppConfig({
      ...valid,
      STORAGE_PREFIX: '',
      STORAGE_FORCE_PATH_STYLE: 'false',
      MEDIA_MAX_IMAGE_BYTES: '1000',
      MEDIA_MAX_VIDEO_BYTES: '2000',
      MEDIA_MAX_PER_ITEM: '3',
    });

    expect(config.storage.prefix).toBe('content/');
    expect(config.storage.forcePathStyle).toBe(false);
    expect(config.media).toEqual({
      maxImageBytes: 1000,
      maxVideoBytes: 2000,
      maxPerItem: 3,
    });
  });

  it.each([
    'DATABASE_URL',
    'CONTENT_INBOUND_TOKEN_GATEWAY',
    'STORAGE_ENDPOINT',
    'STORAGE_BUCKET',
    'STORAGE_ACCESS_KEY_ID',
    'STORAGE_SECRET_ACCESS_KEY',
  ])('names the missing variable %s', (name) => {
    const { [name as keyof typeof valid]: _removed, ...raw } = valid;

    expect(problemsOf(raw).join('\n')).toContain(`${name} is required`);
  });

  it.each([
    ['PORT', 'abc'],
    ['PORT', '70000'],
    ['DATABASE_URL', 'mysql://db/content'],
    ['CONTENT_INBOUND_TOKEN_GATEWAY', 'too-short'],
    ['CONTENT_INBOUND_TOKEN_LIDAR', 'too-short'],
    ['STORAGE_ENDPOINT', 'ftp://store'],
    ['STORAGE_BUCKET', 'Bad_Bucket'],
    ['STORAGE_PREFIX', '../escape/'],
    ['STORAGE_PREFIX', '/absolute/'],
    ['STORAGE_FORCE_PATH_STYLE', 'maybe'],
    ['MEDIA_MAX_IMAGE_BYTES', '-5'],
    ['MEDIA_MAX_VIDEO_BYTES', '99999999999'],
    ['MEDIA_MAX_PER_ITEM', '500'],
  ])('rejects %s=%s without echoing the value', (name, value) => {
    const text = problemsOf({ ...valid, [name]: value }).join('\n');

    expect(text).toContain(name);
    expect(text).not.toContain(value);
  });
});
