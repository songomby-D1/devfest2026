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
});
