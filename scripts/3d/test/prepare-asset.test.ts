import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import type { GlbStats } from '../src/pipeline.ts';
import {
  outputPathsFor,
  prepareAsset,
  type PreparationDependencies,
} from '../src/prepare-asset.ts';

const FAKE_STATS: GlbStats = {
  triangles: 12,
  textures: [{ mimeType: 'image/webp', width: 4, height: 4, bytes: 10 }],
};

interface FakePipeline {
  readonly calls: string[];
  readonly dependencies: PreparationDependencies;
}

function fakePipeline(failingStep?: string): FakePipeline {
  const calls: string[] = [];
  const step = async (name: string, outputPath: string, content: string) => {
    calls.push(name);
    if (name === failingStep) throw new Error(`${name} exploded`);
    await writeFile(outputPath, content);
  };
  return {
    calls,
    dependencies: {
      convert: (_usdz, glb) => step('convert', glb, 'raw'),
      optimize: (_input, output, options) =>
        step(
          `optimize:${options.maxTextureSize ?? 'default'}`,
          output,
          basename(output),
        ),
      renderPoster: (_glb, poster) => step('poster', poster, 'webp'),
      inspectGlb: () => Promise.resolve(FAKE_STATS),
    },
  };
}

describe('prepareAsset', () => {
  let outputDirectory: string;

  beforeEach(async () => {
    outputDirectory = await mkdtemp(join(tmpdir(), 'prepare-asset-test-'));
  });

  afterEach(async () => {
    await rm(outputDirectory, { recursive: true, force: true });
  });

  const request = () => ({
    usdzPath: '/scans/vase.usdz',
    itemId: 'vase',
    outputDirectory,
  });

  it('runs the steps in order and writes the summary', async () => {
    const pipeline = fakePipeline();

    const summary = await prepareAsset(request(), pipeline.dependencies);

    assert.deepEqual(pipeline.calls, [
      'convert',
      'optimize:default',
      'optimize:1024',
      'poster',
    ]);
    assert.deepEqual((await readdir(outputDirectory)).sort(), [
      'vase-1k.glb',
      'vase-2k.glb',
      'vase-poster.webp',
      'vase-summary.json',
    ]);
    assert.deepEqual(summary, {
      itemId: 'vase',
      variants: {
        '1k': { file: 'vase-1k.glb', bytes: 11, ...FAKE_STATS },
        '2k': { file: 'vase-2k.glb', bytes: 11, ...FAKE_STATS },
      },
      poster: { file: 'vase-poster.webp', bytes: 4 },
    });
    const written: unknown = JSON.parse(
      await readFile(outputPathsFor(outputDirectory, 'vase').summary, 'utf8'),
    );
    assert.deepEqual(written, summary);
  });

  it('removes earlier outputs of the item before starting', async () => {
    const paths = outputPathsFor(outputDirectory, 'vase');
    await writeFile(paths.summary, 'stale');
    await writeFile(join(outputDirectory, 'other-1k.glb'), 'keep');
    const pipeline = fakePipeline('convert');

    await assert.rejects(prepareAsset(request(), pipeline.dependencies));

    assert.deepEqual(await readdir(outputDirectory), ['other-1k.glb']);
  });

  for (const failingStep of ['convert', 'optimize:1024', 'poster']) {
    it(`propagates a ${failingStep} failure and leaves no output`, async () => {
      const pipeline = fakePipeline(failingStep);

      await assert.rejects(prepareAsset(request(), pipeline.dependencies), {
        message: `${failingStep} exploded`,
      });

      assert.equal(pipeline.calls.at(-1), failingStep);
      assert.deepEqual(await readdir(outputDirectory), []);
    });
  }

  it('writes no summary when inspection fails', async () => {
    const pipeline = fakePipeline();
    const dependencies: PreparationDependencies = {
      ...pipeline.dependencies,
      inspectGlb: () => Promise.reject(new Error('unreadable GLB')),
    };

    await assert.rejects(prepareAsset(request(), dependencies), {
      message: 'unreadable GLB',
    });

    assert.deepEqual(await readdir(outputDirectory), []);
  });
});
