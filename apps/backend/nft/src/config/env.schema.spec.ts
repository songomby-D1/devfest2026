import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EnvValidationError, validateEnv } from './env.schema';

const DUMMY_ADDRESS = `0x${'ab'.repeat(20)}`;
const DUMMY_KEY = `0x${'11'.repeat(32)}`;

let mediaRoot: string;

beforeAll(() => {
  mediaRoot = mkdtempSync(join(tmpdir(), 'nft-media-'));
});

afterAll(() => {
  rmSync(mediaRoot, { recursive: true, force: true });
});

function validEnv(
  overrides: Record<string, string> = {},
): Record<string, string> {
  return {
    CONTRACT_ADDRESS: DUMMY_ADDRESS,
    MINTER_PRIVATE_KEY: DUMMY_KEY,
    IPFS_DRIVER: 'fake',
    MEDIA_ROOT: mediaRoot,
    ...overrides,
  };
}

function problemsOf(raw: Record<string, string>): readonly string[] {
  try {
    validateEnv(raw);
  } catch (error) {
    if (error instanceof EnvValidationError) {
      return error.problems;
    }
    throw error;
  }
  throw new Error('Expected the environment to be rejected');
}

describe('validateEnv', () => {
  it('applies the defaults of §9.8', () => {
    const env = validateEnv(validEnv());

    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3005,
      CHAIN_RPC_URL: 'https://api.avax-test.network/ext/bc/C/rpc',
      CHAIN_ID: 43113,
      EXPLORER_BASE_URL: 'https://testnet.snowtrace.io',
      IPFS_GATEWAY_URL: 'https://gateway.pinata.cloud/ipfs',
      TX_TIMEOUT_MS: 120000,
      IPFS_TIMEOUT_MS: 600000,
      MINT_MAX_STALLED_COUNT: 3,
      MAX_MASTER_BYTES: 2147483648,
      MAX_IMAGE_BYTES: 20971520,
      MAX_GLB_BYTES: 52428800,
      MAX_VIDEO_BYTES: 104857600,
      MAX_PREVIEW_BYTES: 5242880,
      LOW_BALANCE_AVAX: 0.5,
      BULL_BOARD_ENABLED: false,
    });
    expect(env.FAULT_INJECT).toBeUndefined();
  });

  it('uses "pinata" as the default IPFS driver', () => {
    const { IPFS_DRIVER: _driver, ...withoutDriver } = validEnv({
      PINATA_JWT: 'jwt',
    });

    expect(validateEnv(withoutDriver).IPFS_DRIVER).toBe('pinata');
  });

  it('converts numbers and booleans from strings', () => {
    const env = validateEnv(
      validEnv({
        PORT: '4000',
        CHAIN_ID: '31337',
        LOW_BALANCE_AVAX: '1.25',
        BULL_BOARD_ENABLED: 'true',
      }),
    );

    expect(env.PORT).toBe(4000);
    expect(env.CHAIN_ID).toBe(31337);
    expect(env.LOW_BALANCE_AVAX).toBe(1.25);
    expect(env.BULL_BOARD_ENABLED).toBe(true);
    expect(validateEnv(validEnv({ BULL_BOARD_ENABLED: 'false' }))).toEqual(
      expect.objectContaining({ BULL_BOARD_ENABLED: false }),
    );
  });

  it('accepts a local RPC URL without a top-level domain', () => {
    const env = validateEnv(
      validEnv({ CHAIN_RPC_URL: 'http://hardhat-node:8545' }),
    );

    expect(env.CHAIN_RPC_URL).toBe('http://hardhat-node:8545');
  });

  it('treats empty strings as absent', () => {
    expect(validateEnv(validEnv({ PORT: '' })).PORT).toBe(3005);
    expect(problemsOf(validEnv({ CONTRACT_ADDRESS: '' })).join('\n')).toMatch(
      /CONTRACT_ADDRESS/,
    );
  });

  it('strips variables unknown to the schema', () => {
    const env = validateEnv(validEnv({ UNRELATED_VARIABLE: 'value' }));

    expect(env).not.toHaveProperty('UNRELATED_VARIABLE');
  });

  it.each(['CONTRACT_ADDRESS', 'MINTER_PRIVATE_KEY'])(
    'names the missing required variable %s',
    (name) => {
      const { [name]: _removed, ...raw } = validEnv();

      expect(problemsOf(raw).join('\n')).toContain(name);
    },
  );

  it('requires PINATA_JWT only with the pinata driver', () => {
    expect(problemsOf(validEnv({ IPFS_DRIVER: 'pinata' })).join('\n')).toMatch(
      /PINATA_JWT/,
    );
    expect(() => validateEnv(validEnv({ IPFS_DRIVER: 'fake' }))).not.toThrow();
  });

  it('never echoes the value of an invalid secret', () => {
    const secret = 'my-secret-value-123';
    const problems = problemsOf(validEnv({ MINTER_PRIVATE_KEY: secret }));

    expect(problems.join('\n')).toContain('MINTER_PRIVATE_KEY');
    expect(problems.join('\n')).not.toContain(secret);
  });

  it.each([
    ['PORT', 'abc'],
    ['PORT', '70000'],
    ['CHAIN_ID', '0'],
    ['CONTRACT_ADDRESS', '0x1234'],
    ['MINTER_PRIVATE_KEY', `0x${'11'.repeat(31)}`],
    ['NODE_ENV', 'staging'],
    ['IPFS_DRIVER', 'ipfs'],
    ['CHAIN_RPC_URL', 'not a url'],
    ['EXPLORER_BASE_URL', 'ftp://example.com'],
    ['MINT_MAX_STALLED_COUNT', '-1'],
    ['TX_TIMEOUT_MS', '1.5'],
    ['LOW_BALANCE_AVAX', '-0.1'],
    ['BULL_BOARD_ENABLED', 'yes'],
    ['FAULT_INJECT', 'random'],
  ])('rejects %s=%s', (name, value) => {
    expect(problemsOf(validEnv({ [name]: value })).join('\n')).toContain(name);
  });

  it('rejects a relative or missing MEDIA_ROOT', () => {
    expect(problemsOf(validEnv({ MEDIA_ROOT: 'data/media' }))).toContain(
      'MEDIA_ROOT must be an absolute path to an existing directory',
    );
    expect(
      problemsOf(validEnv({ MEDIA_ROOT: join(mediaRoot, 'missing') })),
    ).toContain('MEDIA_ROOT must be an absolute path to an existing directory');
  });

  it('forbids the fake IPFS driver and Bull Board in production', () => {
    const problems = problemsOf(
      validEnv({
        NODE_ENV: 'production',
        IPFS_DRIVER: 'fake',
        BULL_BOARD_ENABLED: 'true',
      }),
    );

    expect(problems).toContain('IPFS_DRIVER must not be "fake" in production');
    expect(problems).toContain(
      'BULL_BOARD_ENABLED must be false in production',
    );
  });

  it('reports every problem at once', () => {
    const problems = problemsOf({ MEDIA_ROOT: mediaRoot, PORT: 'abc' });
    const text = problems.join('\n');

    expect(text).toContain('PORT');
    expect(text).toContain('CONTRACT_ADDRESS');
    expect(text).toContain('MINTER_PRIVATE_KEY');
    expect(text).toContain('PINATA_JWT');
  });
});
