import 'reflect-metadata';
import { tmpdir } from 'node:os';

// Deterministic, non-secret values for tests that boot the application.
// Unit tests of the schema pass their own environment explicitly.
Object.assign(process.env, {
  NODE_ENV: 'test',
  CONTRACT_ADDRESS: `0x${'ab'.repeat(20)}`,
  MINTER_PRIVATE_KEY: `0x${'11'.repeat(32)}`,
  IPFS_DRIVER: 'fake',
  MEDIA_ROOT: tmpdir(),
  // Nothing listens here: tests that need a database start their own or
  // replace the repository.
  DATABASE_URL: 'postgresql://nft_runtime:test@127.0.0.1:1/nft',
  NFT_INBOUND_TOKEN_GATEWAY: 'gateway-to-nft-test',
  MINT_SWEEP_INTERVAL_MS: '0',
});
