import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AssetPreparationError } from './errors.ts';
import {
  describePageError,
  runInIsolatedPage,
  type BrowserSettings,
} from './isolated-page.ts';
import type { UsdzConverter } from './pipeline.ts';

interface ConverterWindow extends Window {
  convertUsdz?: (url: string) => Promise<string>;
}

const INPUT_URL_PATH = '/input.usdz';

export function createUsdzConverter(
  packageRoot: string,
  browserSettings: BrowserSettings,
): UsdzConverter {
  const three = join(packageRoot, 'node_modules', 'three');
  return async (usdzPath, glbPath) => {
    const content = {
      files: new Map([
        ['/convert.html', join(packageRoot, 'pages', 'convert.html')],
        ['/base64.js', join(packageRoot, 'pages', 'base64.js')],
        [INPUT_URL_PATH, usdzPath],
      ]),
      directories: new Map([
        ['/node_modules/three/build/', join(three, 'build')],
        ['/node_modules/three/examples/jsm/', join(three, 'examples', 'jsm')],
      ]),
    };
    const glbBase64 = await runInIsolatedPage(
      browserSettings,
      { content },
      async (page, origin) => {
        await page.goto(`${origin}/convert.html`);
        await page.waitForFunction(
          () => (window as ConverterWindow).convertUsdz !== undefined,
        );
        try {
          return await page.evaluate(async (url) => {
            const convert = (window as ConverterWindow).convertUsdz;
            if (convert === undefined) throw new Error('Converter not loaded');
            return convert(url);
          }, INPUT_URL_PATH);
        } catch (error) {
          throw new AssetPreparationError(
            `USDZ conversion failed: ${describePageError(error)}`,
          );
        }
      },
    );
    await writeFile(glbPath, Buffer.from(glbBase64, 'base64'));
  };
}
