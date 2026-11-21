import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(appRoot, 'node_modules/three/examples/jsm/libs/draco/gltf');
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
