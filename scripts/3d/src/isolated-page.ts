import { chromium, type Page } from 'playwright';
import { AssetPreparationError } from './errors.ts';
import {
  startStaticServer,
  type StaticServerContent,
} from './static-server.ts';

export interface BrowserSettings {
  readonly executablePath: string | undefined;
}

export interface IsolatedPageRequest {
  readonly content: StaticServerContent;
  readonly viewport?: { readonly width: number; readonly height: number };
}

export type PageTask<T> = (page: Page, origin: string) => Promise<T>;

const PLAYWRIGHT_CALL_PREFIX = /^\w+\.\w+: (Error: )?/;

export function describePageError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const firstLine = message.split('\n', 1)[0] ?? '';
  return firstLine.replace(PLAYWRIGHT_CALL_PREFIX, '');
}

export async function runInIsolatedPage<T>(
  browserSettings: BrowserSettings,
  request: IsolatedPageRequest,
  task: PageTask<T>,
): Promise<T> {
  const server = await startStaticServer(request.content);
  try {
    const browser = await chromium.launch({
      ...(browserSettings.executablePath === undefined
        ? {}
        : { executablePath: browserSettings.executablePath }),
      chromiumSandbox: true,
      // Software WebGL for headless rendering of trusted local files only.
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    try {
      const context = await browser.newContext({
        serviceWorkers: 'block',
        ...(request.viewport === undefined
          ? {}
          : { viewport: request.viewport }),
      });
      const blockedUrls: string[] = [];
      await context.route(
        (url) => url.origin !== server.origin,
        (route) => {
          blockedUrls.push(route.request().url());
          return route.abort();
        },
      );
      const result = await task(await context.newPage(), server.origin);
      if (blockedUrls.length > 0) {
        throw new AssetPreparationError(
          `The page requested other origins: ${blockedUrls.join(', ')}`,
        );
      }
      return result;
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
}
