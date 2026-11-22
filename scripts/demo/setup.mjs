#!/usr/bin/env node
// Prepares the local demo environment (never for shared or hosted environments):
// - root .env from .env.example with random secrets (scripts/setup/init-env.mjs),
// - a random gallery-wallet key (DEMO_MINTER_PRIVATE_KEY) for the local chain,
// - apps/backend/nft/.env pointing at the local chain and the fake IPFS driver.
// Existing values are kept, so it is safe to run again. Usage: node scripts/demo/setup.mjs
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const rootEnv = join(root, '.env');
const nftEnv = join(root, 'apps', 'backend', 'nft', '.env');

execFileSync(
  process.execPath,
  [join(root, 'scripts', 'setup', 'init-env.mjs')],
  {
    cwd: root,
    stdio: 'inherit',
  },
);

function parse(text) {
  const values = new Map();
  for (const line of text.split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (match) values.set(match[1], match[2]);
  }
  return values;
}

/** Sets keys in an env file, appending missing ones and replacing empty or listed ones. */
function upsert(path, entries, { overwrite = [] } = {}) {
  let text = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const current = parse(text);
  for (const [key, value] of Object.entries(entries)) {
    const existing = current.get(key);
    if (existing === undefined) {
      text += `${text.endsWith('\n') || text === '' ? '' : '\n'}${key}=${value}\n`;
    } else if (existing === '' || overwrite.includes(key)) {
      text = text.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${value}`);
    }
  }
  writeFileSync(path, text, { mode: 0o600 });
  return parse(text);
}

const env = upsert(rootEnv, {
  DEMO_MINTER_PRIVATE_KEY: `0x${randomBytes(32).toString('hex')}`,
});

if (!existsSync(nftEnv)) {
  writeFileSync(
    nftEnv,
    readFileSync(join(root, 'apps', 'backend', 'nft', '.env.example')),
    { mode: 0o600 },
  );
}
upsert(
  nftEnv,
  {
    NODE_ENV: 'development',
    CHAIN_RPC_URL: 'http://chain:8545',
    CHAIN_ID: '31337',
    MINTER_PRIVATE_KEY: env.get('DEMO_MINTER_PRIVATE_KEY'),
    EXPLORER_BASE_URL: 'http://localhost:8545',
    IPFS_DRIVER: 'fake',
    IPFS_GATEWAY_URL: 'https://ipfs.io/ipfs',
  },
  {
    overwrite: [
      'NODE_ENV',
      'CHAIN_RPC_URL',
      'CHAIN_ID',
      'MINTER_PRIVATE_KEY',
      'EXPLORER_BASE_URL',
      'IPFS_DRIVER',
    ],
  },
);

process.stdout.write(
  'Demo environment ready: .env and apps/backend/nft/.env (local chain 31337, fake IPFS).\n' +
    'Next: docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --build chain\n' +
    '      node scripts/demo/deploy-contract.mjs\n',
);
