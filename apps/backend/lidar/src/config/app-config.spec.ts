import { describe, expect, it } from 'vitest';
import { InvalidConfigError, loadAppConfig } from './app-config.js';

const validEnv = {
  DATABASE_URL: 'postgresql://lidar:example-password@localhost:5432/lidar',
  CONTENT_SERVICE_URL: 'http://content:3000',
  PUBLIC_ASSET_BASE_PATH: '/api/lidar/files',
  LIDAR_ADMIN_TOKEN: 'x'.repeat(32),
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
    });
  });

  it('lists every missing variable by name', () => {
    expect(captureConfigError({}).invalidVariables).toEqual([
      'CONTENT_SERVICE_URL',
      'DATABASE_URL',
      'LIDAR_ADMIN_TOKEN',
      'PUBLIC_ASSET_BASE_PATH',
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
  ])('rejects an invalid %s', (name, value) => {
    expect(
      captureConfigError({ ...validEnv, [name]: value }).invalidVariables,
    ).toEqual([name]);
  });
});
