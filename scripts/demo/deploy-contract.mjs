#!/usr/bin/env node
// Deploys salandri-42's PreservingArt contract (feature/nft-l1) to the local demo chain,
// owned by the gallery wallet, and writes CONTRACT_ADDRESS into apps/backend/nft/.env.
// Uses the chain's unlocked account, so no key leaves .env. Usage:
//   node scripts/demo/deploy-contract.mjs            (CHAIN_URL defaults to http://127.0.0.1:8545)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const nftEnv = join(here, '..', '..', 'apps', 'backend', 'nft', '.env');
const chainUrl = process.env.CHAIN_URL ?? 'http://127.0.0.1:8545';
const { bytecode } = JSON.parse(
  readFileSync(join(here, 'preserving-art.json'), 'utf8'),
);

let id = 0;
async function rpc(method, params = []) {
  const response = await fetch(chainUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
  });
  const body = await response.json();
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result;
}

const chainId = Number.parseInt(await rpc('eth_chainId'), 16);
if (chainId !== 31337)
  throw new Error(`Refusing to deploy on chain ${chainId}`);

const [owner] = await rpc('eth_accounts');
if (!owner) throw new Error('The chain exposes no unlocked account');

// constructor(address initialOwner): one 32-byte ABI word.
const data = bytecode + owner.slice(2).toLowerCase().padStart(64, '0');
const txHash = await rpc('eth_sendTransaction', [
  { from: owner, data, gas: '0x7a1200' },
]);

let receipt = null;
for (let attempt = 0; attempt < 60 && receipt === null; attempt += 1) {
  receipt = await rpc('eth_getTransactionReceipt', [txHash]);
  if (receipt === null) await new Promise((r) => setTimeout(r, 500));
}
if (receipt === null) throw new Error(`No receipt for ${txHash}`);
if (receipt.status !== '0x1') throw new Error(`Deployment reverted: ${txHash}`);

const address = receipt.contractAddress;
const env = readFileSync(nftEnv, 'utf8');
writeFileSync(
  nftEnv,
  /^CONTRACT_ADDRESS=.*$/m.test(env)
    ? env.replace(/^CONTRACT_ADDRESS=.*$/m, `CONTRACT_ADDRESS=${address}`)
    : `${env}\nCONTRACT_ADDRESS=${address}\n`,
  { mode: 0o600 },
);

process.stdout.write(
  `PreservingArt deployed on chain ${chainId}\n` +
    `  contract: ${address}\n  owner (gallery wallet): ${owner}\n  tx: ${txHash}\n` +
    'CONTRACT_ADDRESS written to apps/backend/nft/.env\n',
);
