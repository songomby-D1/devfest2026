import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import {
  access,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { AssetSummary } from '../src/prepare-asset.ts';
import {
  CUBE_TEXTURE_SIZE,
  CUBE_TRIANGLES,
  texturedCubeUsdz,
} from './usdz-fixture.ts';

const CLI_ENTRY = join(import.meta.dirname, '..', 'src', 'cli.ts');
const CHROME_PATH =
  process.env['CHROME_PATH'] ?? '/usr/bin/google-chrome-stable';
const CLI_TIMEOUT_MS = 180_000;

async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

interface CliResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

function runCli(args: readonly string[]): Promise<CliResult> {
  return new Promise((resolveRun) => {
    execFile(
      process.execPath,
      [CLI_ENTRY, ...args],
      {
        env: { ...process.env, CHROME_PATH },
        timeout: CLI_TIMEOUT_MS,
      },
      (error, stdout, stderr) => {
        const exitCode =
          typeof error?.code === 'number' ? error.code : error ? -1 : 0;
        resolveRun({ exitCode, stdout, stderr });
      },
    );
  });
}

const chromeMissing = !(await isExecutable(CHROME_PATH));
const skipReason = chromeMissing
  ? `Chrome not found at ${CHROME_PATH}; set CHROME_PATH to run the integration tests`
  : false;

describe('prepare-asset CLI with a real browser', { skip: skipReason }, () => {
  let workDirectory: string;

  before(async () => {
    workDirectory = await mkdtemp(join(tmpdir(), 'prepare-asset-cli-'));
  });

  after(async () => {
    await rm(workDirectory, { recursive: true, force: true });
  });

  it(
    'turns a textured USDZ into the four outputs',
    { timeout: CLI_TIMEOUT_MS },
    async () => {
      const usdzPath = join(workDirectory, 'cube.usdz');
      const outputDirectory = join(workDirectory, 'out');
      await writeFile(usdzPath, texturedCubeUsdz());

      const result = await runCli([usdzPath, 'cube', outputDirectory]);

      assert.equal(result.exitCode, 0, result.stderr);
      assert.deepEqual((await readdir(outputDirectory)).sort(), [
        'cube-1k.glb',
        'cube-2k.glb',
        'cube-poster.webp',
        'cube-summary.json',
      ]);
      const summary = JSON.parse(
        await readFile(join(outputDirectory, 'cube-summary.json'), 'utf8'),
      ) as AssetSummary;
      assert.deepEqual(JSON.parse(result.stdout), summary);
      for (const [variant, file] of [
        ['1k', 'cube-1k.glb'],
        ['2k', 'cube-2k.glb'],
      ] as const) {
        const variantSummary = summary.variants[variant];
        assert.equal(variantSummary.file, file);
        assert.equal(
          variantSummary.bytes,
          (await stat(join(outputDirectory, file))).size,
        );
        assert.equal(variantSummary.triangles, CUBE_TRIANGLES);
        assert.deepEqual(
          variantSummary.textures.map(({ mimeType, width, height }) => ({
            mimeType,
            width,
            height,
          })),
          [
            {
              mimeType: 'image/webp',
              width: CUBE_TEXTURE_SIZE,
              height: CUBE_TEXTURE_SIZE,
            },
          ],
        );
      }
      const posterBytes = (
        await stat(join(outputDirectory, 'cube-poster.webp'))
      ).size;
      assert.ok(posterBytes > 0);
      assert.deepEqual(summary.poster, {
        file: 'cube-poster.webp',
        bytes: posterBytes,
      });
    },
  );

  it(
    'fails with an explicit message and no output on a corrupted USDZ',
    { timeout: CLI_TIMEOUT_MS },
    async () => {
      const usdzPath = join(workDirectory, 'corrupted.usdz');
      const outputDirectory = join(workDirectory, 'corrupted-out');
      await writeFile(usdzPath, texturedCubeUsdz().subarray(0, 200));

      const result = await runCli([usdzPath, 'corrupted', outputDirectory]);

      assert.equal(result.exitCode, 1);
      assert.match(result.stderr, /^error: USDZ conversion failed: .+/);
      assert.equal(result.stdout, '');
      assert.deepEqual(await readdir(outputDirectory), []);
    },
  );
});

describe('prepare-asset CLI input validation', () => {
  it('rejects a file that is not a USDZ archive', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'prepare-asset-cli-'));
    try {
      const notUsdz = join(directory, 'scan.usdz');
      await writeFile(notUsdz, 'plain text');

      const result = await runCli([notUsdz, 'scan', join(directory, 'out')]);

      assert.equal(result.exitCode, 2);
      assert.match(result.stderr, /is not a USDZ archive/);
      assert.deepEqual(await readdir(directory), ['scan.usdz']);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
