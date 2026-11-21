import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AssetPreparationError } from './errors.ts';
import {
  describePageError,
  runInIsolatedPage,
  type BrowserSettings,
} from './isolated-page.ts';
import type { PosterRenderer } from './pipeline.ts';

interface PosterWindow extends Window {
  modelState?: 'loaded' | 'failed';
  modelError?: string;
  renderPoster?: () => Promise<string>;
}

const VIEWPORT = { width: 1024, height: 1024 };
const MODEL_LOAD_TIMEOUT_MS = 120_000;
// Same settle delay as the validated 3D-03 procedure, whose reference posters it reproduces.
const RENDER_SETTLE_MS = 1000;

export function createPosterRenderer(
  packageRoot: string,
  browserSettings: BrowserSettings,
): PosterRenderer {
  const nodeModules = join(packageRoot, 'node_modules');
  return async (glbPath, posterPath) => {
    const content = {
      files: new Map([
        ['/poster.html', join(packageRoot, 'pages', 'poster.html')],
        ['/base64.js', join(packageRoot, 'pages', 'base64.js')],
        ['/model.glb', glbPath],
      ]),
      directories: new Map([
        [
          '/node_modules/@google/model-viewer/dist/',
          join(nodeModules, '@google', 'model-viewer', 'dist'),
        ],
        [
          '/node_modules/three/examples/jsm/libs/draco/gltf/',
          join(
            nodeModules,
            'three',
            'examples',
            'jsm',
            'libs',
            'draco',
            'gltf',
          ),
        ],
      ]),
    };
    const posterBase64 = await runInIsolatedPage(
      browserSettings,
      { content, viewport: VIEWPORT },
      async (page, origin) => {
        try {
          await page.goto(`${origin}/poster.html`);
          await page.waitForFunction(
            () => (window as PosterWindow).modelState !== undefined,
            null,
            { timeout: MODEL_LOAD_TIMEOUT_MS },
          );
          const modelError = await page.evaluate(() => {
            const posterWindow = window as PosterWindow;
            return posterWindow.modelState === 'failed'
              ? (posterWindow.modelError ?? 'unknown error')
              : null;
          });
          if (modelError !== null) {
            throw new Error(`model failed to load: ${modelError}`);
          }
          await page.waitForTimeout(RENDER_SETTLE_MS);
          return await page.evaluate(async () => {
            const render = (window as PosterWindow).renderPoster;
            if (render === undefined) throw new Error('Renderer not loaded');
            return render();
          });
        } catch (error) {
          throw new AssetPreparationError(
            `Poster rendering failed: ${describePageError(error)}`,
          );
        }
      },
    );
    await writeFile(posterPath, Buffer.from(posterBase64, 'base64'));
  };
}
