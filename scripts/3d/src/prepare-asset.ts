import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import type {
  GlbInspector,
  GlbOptimizer,
  GlbStats,
  PosterRenderer,
  UsdzConverter,
} from './pipeline.ts';

export interface PreparationDependencies {
  readonly convert: UsdzConverter;
  readonly optimize: GlbOptimizer;
  readonly renderPoster: PosterRenderer;
  readonly inspectGlb: GlbInspector;
}

export interface PreparationRequest {
  readonly usdzPath: string;
  readonly itemId: string;
  readonly outputDirectory: string;
}

export interface OutputPaths {
  readonly glb1k: string;
  readonly glb2k: string;
  readonly poster: string;
  readonly summary: string;
}

export interface GlbVariantSummary extends GlbStats {
  readonly file: string;
  readonly bytes: number;
}

export interface AssetSummary {
  readonly itemId: string;
  readonly variants: {
    readonly '1k': GlbVariantSummary;
    readonly '2k': GlbVariantSummary;
  };
  readonly poster: { readonly file: string; readonly bytes: number };
}

const TEXTURE_SIZE_1K = 1024;

export function outputPathsFor(
  outputDirectory: string,
  itemId: string,
): OutputPaths {
  return {
    glb1k: join(outputDirectory, `${itemId}-1k.glb`),
    glb2k: join(outputDirectory, `${itemId}-2k.glb`),
    poster: join(outputDirectory, `${itemId}-poster.webp`),
    summary: join(outputDirectory, `${itemId}-summary.json`),
  };
}

async function removeOutputs(paths: OutputPaths): Promise<void> {
  await Promise.all(
    Object.values(paths).map((path) => rm(path, { force: true })),
  );
}

async function fileBytes(path: string): Promise<number> {
  return (await stat(path)).size;
}

async function summarizeVariant(
  path: string,
  inspectGlb: GlbInspector,
): Promise<GlbVariantSummary> {
  const [bytes, stats] = await Promise.all([fileBytes(path), inspectGlb(path)]);
  return { file: basename(path), bytes, ...stats };
}

async function buildOutputs(
  request: PreparationRequest,
  paths: OutputPaths,
  workDirectory: string,
  dependencies: PreparationDependencies,
): Promise<AssetSummary> {
  const rawGlb = join(workDirectory, `${request.itemId}-raw.glb`);
  await dependencies.convert(request.usdzPath, rawGlb);
  await dependencies.optimize(rawGlb, paths.glb2k, {});
  await dependencies.optimize(rawGlb, paths.glb1k, {
    maxTextureSize: TEXTURE_SIZE_1K,
  });
  await dependencies.renderPoster(paths.glb1k, paths.poster);
  return {
    itemId: request.itemId,
    variants: {
      '1k': await summarizeVariant(paths.glb1k, dependencies.inspectGlb),
      '2k': await summarizeVariant(paths.glb2k, dependencies.inspectGlb),
    },
    poster: {
      file: basename(paths.poster),
      bytes: await fileBytes(paths.poster),
    },
  };
}

export async function prepareAsset(
  request: PreparationRequest,
  dependencies: PreparationDependencies,
): Promise<AssetSummary> {
  const paths = outputPathsFor(request.outputDirectory, request.itemId);
  await removeOutputs(paths);
  await mkdir(request.outputDirectory, { recursive: true });
  const workDirectory = await mkdtemp(join(tmpdir(), 'prepare-asset-'));
  try {
    const summary = await buildOutputs(
      request,
      paths,
      workDirectory,
      dependencies,
    );
    await writeFile(paths.summary, `${JSON.stringify(summary, null, 2)}\n`);
    return summary;
  } catch (error) {
    await removeOutputs(paths);
    throw error;
  } finally {
    await rm(workDirectory, { recursive: true, force: true });
  }
}
