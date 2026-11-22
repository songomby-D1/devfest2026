#!/usr/bin/env node
// NFT and blockchain acceptance walkthrough against the local demo (gateway + local chain).
// It drives the real API as a guest, a visitor and the item owner, then verifies the
// result independently on-chain through raw JSON-RPC (no NFT-service code involved).
// Usage: node scripts/demo/nft-walkthrough.mjs ["Item title"] [--all]
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  api,
  check,
  demoAccounts,
  finish,
  nftEnv,
  root,
  rpc,
  section,
  session,
  sleep,
} from './lib.mjs';

const args = process.argv.slice(2);
const mintAll = args.includes('--all');
const title = args.find((arg) => !arg.startsWith('--')) ?? 'Malagasy Woman';
const works = JSON.parse(
  readFileSync(join(root, 'scripts', 'demo', 'items.json'), 'utf8'),
);
const accounts = demoAccounts();
const contract = (nftEnv.get('CONTRACT_ADDRESS') ?? '').toLowerCase();

// --- tiny ABI helpers over JSON-RPC ---
const hex = (text) => `0x${Buffer.from(text, 'utf8').toString('hex')}`;
const selector = async (signature) =>
  (await rpc('web3_sha3', [hex(signature)])).slice(0, 10);
const word = (value) => BigInt(value).toString(16).padStart(64, '0');
async function call(signature, ...words) {
  return rpc('eth_call', [
    { to: contract, data: (await selector(signature)) + words.join('') },
    'latest',
  ]);
}
function decodeString(data) {
  const body = data.slice(2);
  const offset = Number.parseInt(body.slice(0, 64), 16) * 2;
  const length = Number.parseInt(body.slice(offset, offset + 64), 16);
  return Buffer.from(
    body.slice(offset + 64, offset + 64 + length * 2),
    'hex',
  ).toString('utf8');
}
const asAddress = (data) => `0x${data.slice(-40)}`;

async function mintAndVerify(item, owner, { negative }) {
  section(`Mint "${item.title}" (${item.id})`);
  const work = works.find((candidate) => candidate.item.title === item.title);

  const before = await api('GET', `/api/items/${item.id}/provenance`);
  check(
    'provenance is readable by a guest before minting',
    before.status === 200,
    `status=${before.status}`,
  );
  const already = before.body?.mint?.status === 'confirmed';
  if (already) check('already minted on an earlier run', true);

  if (negative) {
    const key = randomBytes(12).toString('hex');
    const guest = await api('POST', `/api/items/${item.id}/mint`, {
      headers: { 'idempotency-key': key },
    });
    check(
      'a guest cannot mint (401)',
      guest.status === 401,
      `status=${guest.status}`,
    );
    const visitor = await session(
      accounts.visitor.email,
      accounts.visitor.password,
      accounts.visitor.displayName,
    );
    const notOwner = await api('POST', `/api/items/${item.id}/mint`, {
      cookie: visitor,
      headers: { 'idempotency-key': key },
    });
    check(
      'a signed-in visitor who is not the owner cannot mint (403)',
      notOwner.status === 403,
      `status=${notOwner.status} ${JSON.stringify(notOwner.body)}`,
    );
    const noKey = await api('POST', `/api/items/${item.id}/mint`, {
      cookie: owner,
    });
    check(
      'the owner must send an Idempotency-Key (400)',
      noKey.status === 400,
      `status=${noKey.status}`,
    );
  }

  let mintId = before.body?.mint?.id;
  if (!already) {
    const key = `demo-${randomBytes(12).toString('hex')}`;
    const first = await api('POST', `/api/items/${item.id}/mint`, {
      cookie: owner,
      headers: { 'idempotency-key': key },
    });
    check(
      'the owner requests the mint: 202 pending',
      first.status === 202 && first.body?.status === 'pending',
      `${first.status} ${JSON.stringify(first.body)}`,
    );
    mintId = first.body?.id;
    if (negative) {
      const replay = await api('POST', `/api/items/${item.id}/mint`, {
        cookie: owner,
        headers: { 'idempotency-key': key },
      });
      check(
        'replaying the same key returns the same mint (idempotent)',
        replay.status === 200 && replay.body?.id === mintId,
        `${replay.status} ${JSON.stringify(replay.body)}`,
      );
      const other = await api('POST', `/api/items/${item.id}/mint`, {
        cookie: owner,
        headers: {
          'idempotency-key': `demo-${randomBytes(12).toString('hex')}`,
        },
      });
      check(
        'a second mint of the same item is refused (409)',
        other.status === 409,
        `${other.status} ${JSON.stringify(other.body)}`,
      );
    }
  }

  let provenance;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    provenance = await api('GET', `/api/items/${item.id}/provenance`);
    const status = provenance.body?.mint?.status;
    if (status === 'confirmed' || status === 'failed') break;
    await sleep(1000);
  }
  const mint = provenance.body?.mint ?? {};
  if (
    !check(
      'the mint is confirmed on-chain',
      mint.status === 'confirmed',
      JSON.stringify(provenance.body),
    )
  )
    return;
  process.stdout.write(
    `       tokenId=${mint.tokenId} tx=${mint.transactionHash}\n`,
  );
  check(
    'provenance names the deployed contract',
    String(
      mint.network?.contractAddress ??
        mint.contractAddress ??
        provenance.body?.contractAddress ??
        '',
    ).toLowerCase() === contract,
    JSON.stringify(mint),
  );
  check(
    'the token URI points to IPFS',
    String(mint.tokenUri ?? '').startsWith('ipfs://'),
    mint.tokenUri,
  );
  check(
    'the service verified the token on-chain',
    provenance.body?.verification?.state === 'verified',
    JSON.stringify(provenance.body?.verification),
  );

  section('Independent on-chain checks (raw JSON-RPC)');
  const tokenId = word(mint.tokenId);
  const gallery = (await rpc('eth_accounts'))[0].toLowerCase();
  check(
    'ownerOf(token) is the gallery wallet (custodial, S2)',
    asAddress(await call('ownerOf(uint256)', tokenId)) === gallery,
  );
  check(
    'tokenURI(token) on-chain equals the provenance token URI',
    decodeString(await call('tokenURI(uint256)', tokenId)) === mint.tokenUri,
  );
  const fileHash = createHash('sha256')
    .update(readFileSync(join(root, 'scripts', 'demo', 'media', work.file)))
    .digest('hex');
  check(
    'masterHash equals the sha256 of the original image file',
    String(mint.masterHash).toLowerCase() === `0x${fileHash}`,
    `${mint.masterHash} vs 0x${fileHash}`,
  );
  const fixity = await call('verifyFixity(uint256,bytes32)', tokenId, fileHash);
  check(
    'verifyFixity(token, sha256(file)) returns true on-chain',
    BigInt(fixity) === 1n,
  );
  const tampered = await call(
    'verifyFixity(uint256,bytes32)',
    tokenId,
    createHash('sha256').update('tampered').digest('hex'),
  );
  check('verifyFixity rejects a different file hash', BigInt(tampered) === 0n);
  if (mint.transactionHash) {
    const receipt = await rpc('eth_getTransactionReceipt', [
      mint.transactionHash,
    ]);
    const topic = await rpc('web3_sha3', [
      hex('ArtworkMinted(uint256,bytes32,uint8,bytes32,string)'),
    ]);
    check(
      'the mint transaction succeeded and emitted ArtworkMinted',
      receipt?.status === '0x1' &&
        receipt.logs.some((log) => log.topics[0] === topic),
    );
  }
}

section('Setup');
check(
  'CONTRACT_ADDRESS is configured',
  /^0x[0-9a-f]{40}$/.test(contract),
  contract,
);
check(
  'the contract is deployed',
  (await rpc('eth_getCode', [contract, 'latest'])).length > 2,
);
const owner = await session(
  accounts.contributor.email,
  accounts.contributor.password,
  accounts.contributor.displayName,
);
const gallery = await api('GET', '/api/items?limit=50');
const items = (gallery.body?.items ?? []).filter((item) =>
  works.some((work) => work.item.title === item.title),
);
check('the seeded works are published (run seed.mjs first)', items.length > 0);

const target = items.find((item) => item.title === title);
if (target) await mintAndVerify(target, owner, { negative: true });
if (mintAll)
  for (const item of items.filter((candidate) => candidate !== target))
    await mintAndVerify(item, owner, { negative: false });

section('Drafts cannot be minted');
const draft = await api('POST', '/api/items', {
  cookie: owner,
  body: {
    ...works[0].item,
    title: `Unpublished draft ${randomBytes(3).toString('hex')}`,
  },
});
if (
  check('the owner creates a draft', draft.status === 201, `${draft.status}`)
) {
  const refused = await api('POST', `/api/items/${draft.body.id}/mint`, {
    cookie: owner,
    headers: { 'idempotency-key': `demo-${randomBytes(12).toString('hex')}` },
  });
  check(
    'minting an unpublished item is refused',
    refused.status === 409 || refused.status === 404,
    `${refused.status} ${JSON.stringify(refused.body)}`,
  );
  const hidden = await api('GET', `/api/items/${draft.body.id}/provenance`);
  check(
    'a draft has no public provenance (404)',
    hidden.status === 404,
    `${hidden.status}`,
  );
}

section('Chain totals');
process.stdout.write(
  `  totalMinted() = ${BigInt(await call('totalMinted()'))}\n`,
);
finish();
