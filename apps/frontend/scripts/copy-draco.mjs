import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
// Resolve three through Node so the script works whether npm hoists it to the
// workspace root or keeps it in this app's node_modules.
const threeRoot = join(
  dirname(createRequire(import.meta.url).resolve('three')),
  '..',
);
const source = join(threeRoot, 'examples/jsm/libs/draco/gltf');
const target = join(appRoot, 'public/draco');
const decoderFiles = [
  'draco_decoder.js',
  'draco_decoder.wasm',
  'draco_wasm_wrapper.js',
];

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
for (const file of decoderFiles) {
  cpSync(join(source, file), join(target, file));
}
