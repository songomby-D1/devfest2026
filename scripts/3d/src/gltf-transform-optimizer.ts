import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { AssetPreparationError } from './errors.ts';
import type { GlbOptimizer, OptimizeOptions } from './pipeline.ts';

const execFileAsync = promisify(execFile);

export function optimizeArguments(
  inputPath: string,
  outputPath: string,
  options: OptimizeOptions,
): string[] {
  return [
    'optimize',
    inputPath,
    outputPath,
    '--compress',
    'draco',
    '--texture-compress',
    'webp',
    ...(options.maxTextureSize === undefined
      ? []
      : ['--texture-size', String(options.maxTextureSize)]),
  ];
}

function describeProcessError(error: unknown): string {
  if (error instanceof Error && 'stderr' in error) {
    const stderr = String(error.stderr).trim();
    if (stderr !== '') return stderr;
  }
  return error instanceof Error ? error.message : String(error);
}

export function createGltfTransformOptimizer(
  packageRoot: string,
): GlbOptimizer {
  const cliEntry = join(
    packageRoot,
    'node_modules',
    '@gltf-transform',
    'cli',
    'bin',
    'cli.js',
  );
  return async (inputPath, outputPath, options) => {
    try {
      await execFileAsync(process.execPath, [
        cliEntry,
        ...optimizeArguments(inputPath, outputPath, options),
      ]);
    } catch (error) {
      throw new AssetPreparationError(
        `gltf-transform optimize failed for ${outputPath}: ${describeProcessError(error)}`,
      );
    }
  };
}
