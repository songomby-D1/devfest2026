import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { artifacts } from 'hardhat';

// The service loads this ABI at runtime instead of the Hardhat build
// artifacts (nft_context.md §8.6 and anti-pattern A9).
const ABI_FILE = resolve(
  __dirname,
  '../../src/blockchain/abi/PreservingArt.abi.json',
);

async function main(): Promise<void> {
  const artifact = await artifacts.readArtifact('PreservingArt');
  mkdirSync(dirname(ABI_FILE), { recursive: true });
  writeFileSync(ABI_FILE, `${JSON.stringify(artifact.abi, null, 2)}\n`);
  process.stdout.write(`ABI written to ${ABI_FILE}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
