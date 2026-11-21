import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';

export interface StaticServerContent {
  readonly files: ReadonlyMap<string, string>;
  readonly directories: ReadonlyMap<string, string>;
}

export interface StaticServer {
  readonly origin: string;
  close(): Promise<void>;
}

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
  '.usdz': 'model/vnd.usdz+zip',
};

function resolveInDirectory(
  directory: string,
  relativePath: string,
): string | undefined {
  const candidate = resolve(directory, relativePath);
  const fromDirectory = relative(directory, candidate);
  if (
    fromDirectory === '..' ||
    fromDirectory.startsWith(`..${sep}`) ||
    isAbsolute(fromDirectory)
  ) {
    return undefined;
  }
  return candidate;
}

export function resolveRequestPath(
  content: StaticServerContent,
  pathname: string,
): string | undefined {
  const exactFile = content.files.get(pathname);
  if (exactFile !== undefined) return exactFile;
  for (const [prefix, directory] of content.directories) {
    if (pathname.startsWith(prefix)) {
      return resolveInDirectory(directory, pathname.slice(prefix.length));
    }
  }
  return undefined;
}

function decodePathname(url: string | undefined): string | undefined {
  try {
    return decodeURIComponent(new URL(url ?? '', 'http://localhost').pathname);
  } catch {
    return undefined;
  }
}

async function handleRequest(
  content: StaticServerContent,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405).end();
    return;
  }
  const pathname = decodePathname(request.url);
  const filePath =
    pathname === undefined ? undefined : resolveRequestPath(content, pathname);
  const fileStats =
    filePath === undefined ? undefined : await statFile(filePath);
  if (filePath === undefined || fileStats === undefined) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, {
    'Content-Type':
      CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream',
    'Content-Length': fileStats.size,
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  createReadStream(filePath)
    .on('error', () => response.destroy())
    .pipe(response);
}

async function statFile(
  filePath: string,
): Promise<{ size: number } | undefined> {
  try {
    const fileStats = await stat(filePath);
    return fileStats.isFile() ? fileStats : undefined;
  } catch {
    return undefined;
  }
}

export async function startStaticServer(
  content: StaticServerContent,
): Promise<StaticServer> {
  const server = createServer((request, response) => {
    handleRequest(content, request, response).catch(() => {
      response.destroy();
    });
  });
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', () => resolveListen());
  });
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolveClose, rejectClose) => {
        server.closeAllConnections();
        server.close((error) => (error ? rejectClose(error) : resolveClose()));
      }),
  };
}
