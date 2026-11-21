import { resolve } from 'node:path';
import { browserSettingsFrom, parseArguments } from './cli-arguments.ts';
import { InvalidInputError } from './errors.ts';
import { createGlbInspector } from './glb-inspector.ts';
import { createGltfTransformOptimizer } from './gltf-transform-optimizer.ts';
import { createPosterRenderer } from './poster-renderer.ts';
import { prepareAsset } from './prepare-asset.ts';
import { assertUsdzArchive } from './usdz-input.ts';
import { createUsdzConverter } from './usdz-converter.ts';

const EXIT_INVALID_INPUT = 2;
const EXIT_PREPARATION_FAILED = 1;

async function main(): Promise<void> {
  // npm run switches to the package directory and keeps the caller's directory in INIT_CWD.
  const workingDirectory = process.env['INIT_CWD'] ?? process.cwd();
  const request = parseArguments(process.argv.slice(2), workingDirectory);
  await assertUsdzArchive(request.usdzPath);
  const packageRoot = resolve(import.meta.dirname, '..');
  const browserSettings = browserSettingsFrom(process.env);
  const summary = await prepareAsset(request, {
    convert: createUsdzConverter(packageRoot, browserSettings),
    optimize: createGltfTransformOptimizer(packageRoot),
    renderPoster: createPosterRenderer(packageRoot, browserSettings),
    inspectGlb: await createGlbInspector(),
  });
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`error: ${message}`);
  process.exitCode =
    error instanceof InvalidInputError
      ? EXIT_INVALID_INPUT
      : EXIT_PREPARATION_FAILED;
}
