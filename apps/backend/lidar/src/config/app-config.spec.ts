import { describe, expect, it } from 'vitest';
import { inspect } from 'node:util';
import { InvalidConfigError, loadAppConfig } from './app-config.js';

const STORAGE_SECRET = 'storage-secret-value-0123456789';

const validEnv = {
  DATABASE_URL: 'postgresql://lidar:example-password@localhost:5432/lidar',
  CONTENT_SERVICE_URL: 'http://content:3000',
  PUBLIC_ASSET_BASE_PATH: '/api/lidar/files',
  LIDAR_ADMIN_TOKEN: 'x'.repeat(32),
  STORAGE_ENDPOINT: 'http://seaweedfs:8333',
  STORAGE_BUCKET: 'lidar-assets',
  STORAGE_ACCESS_KEY_ID: 'lidar-access-key',
  STORAGE_SECRET_ACCESS_KEY: STORAGE_SECRET,
};

function captureConfigError(env: NodeJS.ProcessEnv): InvalidConfigError {
  try {
    loadAppConfig(env);
  } catch (error) {
    if (error instanceof InvalidConfigError) return error;
    throw error;
  }
  throw new Error('Expected loadAppConfig to throw');
}

describe('loadAppConfig', () => {
  it('maps a valid environment and defaults the port', () => {
    expect(loadAppConfig(validEnv)).toEqual({
      port: 3000,
      databaseUrl: validEnv.DATABASE_URL,
      contentServiceUrl: validEnv.CONTENT_SERVICE_URL,
      publicAssetBasePath: validEnv.PUBLIC_ASSET_BASE_PATH,
      adminToken: validEnv.LIDAR_ADMIN_TOKEN,
      storage: {
        endpoint: validEnv.STORAGE_ENDPOINT,
        region: 'us-east-1',
        bucket: validEnv.STORAGE_BUCKET,
        prefix: '',
        forcePathStyle: true,
        credentials: {
          accessKeyId: validEnv.STORAGE_ACCESS_KEY_ID,
          secretAccessKey: STORAGE_SECRET,
        },
      },
    });
  });

  it('maps the optional storage settings', () => {
    const { storage } = loadAppConfig({
      ...validEnv,
      STORAGE_REGION: 'eu-west-3',
      STORAGE_PREFIX: 'lidar/assets/',
      STORAGE_FORCE_PATH_STYLE: 'false',
    });
    expect(storage).toMatchObject({
      region: 'eu-west-3',
      prefix: 'lidar/assets/',
      forcePathStyle: false,
    });
  });

  it('redacts storage credentials when the config is logged or serialized', () => {
    const config = loadAppConfig(validEnv);
    expect(JSON.stringify(config)).not.toContain(STORAGE_SECRET);
    expect(inspect(config, { depth: 10 })).not.toContain(STORAGE_SECRET);
    expect(String(config.storage.credentials)).not.toContain(STORAGE_SECRET);
    expect(config.storage.credentials.secretAccessKey).toBe(STORAGE_SECRET);
  });

  it('lists every missing variable by name', () => {
    expect(captureConfigError({}).invalidVariables).toEqual([
      'CONTENT_SERVICE_URL',
      'DATABASE_URL',
      'LIDAR_ADMIN_TOKEN',
      'PUBLIC_ASSET_BASE_PATH',
      'STORAGE_ACCESS_KEY_ID',
      'STORAGE_BUCKET',
      'STORAGE_ENDPOINT',
      'STORAGE_SECRET_ACCESS_KEY',
    ]);
  });

  it('never includes variable values in the error message', () => {
    const error = captureConfigError({
      ...validEnv,
      LIDAR_ADMIN_TOKEN: 'short-secret',
    });
    expect(error.invalidVariables).toEqual(['LIDAR_ADMIN_TOKEN']);
    expect(error.message).not.toContain('short-secret');
  });

  it.each([
    ['PORT', '70000'],
    ['DATABASE_URL', 'mysql://localhost/lidar'],
    ['CONTENT_SERVICE_URL', 'ftp://content'],
    ['PUBLIC_ASSET_BASE_PATH', 'api/lidar/files'],
    ['PUBLIC_ASSET_BASE_PATH', '/api/lidar/files/'],
    ['PUBLIC_ASSET_BASE_PATH', '/api/../files'],
    ['STORAGE_ENDPOINT', 'ftp://seaweedfs'],
    ['STORAGE_BUCKET', 'Lidar_Assets'],
    ['STORAGE_PREFIX', '/lidar/'],
    ['STORAGE_PREFIX', 'lidar'],
    ['STORAGE_PREFIX', 'lidar/../'],
    ['STORAGE_FORCE_PATH_STYLE', 'yes'],
    ['STORAGE_SECRET_ACCESS_KEY', ''],
  ])('rejects an invalid %s', (name, value) => {
    expect(
      captureConfigError({ ...validEnv, [name]: value }).invalidVariables,
    ).toEqual([name]);
  });
});
