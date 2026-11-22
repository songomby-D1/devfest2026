// Shared helpers for the local demo scripts: gateway calls with a session cookie, the
// local chain's JSON-RPC, and a small check reporter.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const gateway = process.env.GATEWAY_URL ?? 'http://localhost:3000';
export const chainUrl = process.env.CHAIN_URL ?? 'http://127.0.0.1:8545';
const origin = process.env.DEMO_ORIGIN ?? 'http://localhost:5173';

export function readEnv(path) {
  const values = new Map();
  if (!existsSync(path)) return values;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (match) values.set(match[1], match[2]);
  }
  return values;
}

export const rootEnv = readEnv(join(root, '.env'));
export const nftEnv = readEnv(join(root, 'apps', 'backend', 'nft', '.env'));

/** Calls the gateway. `body` is JSON unless it is FormData. Returns status, headers and parsed body. */
export async function api(method, path, { body, cookie, headers = {} } = {}) {
  const all = { accept: 'application/json', origin, ...headers };
  if (cookie) all.cookie = cookie;
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    all['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const response = await fetch(new URL(path, gateway), {
    method,
    headers: all,
    body: payload,
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = text.length > 0 ? JSON.parse(text) : undefined;
  } catch {
    parsed = text;
  }
  return { status: response.status, headers: response.headers, body: parsed };
}

/** Registers (if needed) and logs in; returns the session cookie. */
export async function session(email, password, displayName) {
  const registered = await api('POST', '/api/auth/register', {
    body: { email, password, displayName },
  });
  if (registered.status !== 201 && registered.status !== 409) {
    throw new Error(
      `register ${email}: ${registered.status} ${JSON.stringify(registered.body)}`,
    );
  }
  const login = await api('POST', '/api/auth/login', {
    body: { email, password },
  });
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  if (login.status !== 200 || !cookie) {
    throw new Error(
      `login ${email}: ${login.status} ${JSON.stringify(login.body)}`,
    );
  }
  return cookie;
}

let rpcId = 0;
export async function rpc(method, params = []) {
  const response = await fetch(chainUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  });
  const body = await response.json();
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result;
}

let failures = 0;
export function check(label, condition, detail = '') {
  process.stdout.write(
    `  ${condition ? 'ok  ' : 'FAIL'} ${label}${condition ? '' : ` ${detail}`}\n`,
  );
  if (!condition) failures += 1;
  return condition;
}
export function section(title) {
  process.stdout.write(`\n${title}\n`);
}
export function finish() {
  process.stdout.write(
    failures === 0
      ? '\nAll checks passed.\n'
      : `\n${failures} check(s) failed.\n`,
  );
  process.exitCode = failures === 0 ? 0 : 1;
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Demo accounts. Passwords are local-demo only and derived from the root .env secret. */
export function demoAccounts() {
  const salt = (rootEnv.get('GATEWAY_ADMIN_TOKEN') ?? 'local').slice(0, 12);
  return {
    contributor: {
      email: 'mika.contributor@lova.test',
      password: `Contributor ${salt}`,
      displayName: 'Mika (contributor)',
    },
    reviewer: {
      email: 'sedra.reviewer@lova.test',
      password: `Reviewer ${salt}`,
      displayName: 'Sedra (reviewer)',
    },
    visitor: {
      email: 'visitor@lova.test',
      password: `Visitor ${salt}`,
      displayName: 'A visitor',
    },
  };
}
