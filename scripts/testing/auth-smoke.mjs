#!/usr/bin/env node
// End-to-end smoke test of the Auth journey through a running gateway (MVP section A):
// guest browsing, registration, login, a protected call, logout and rejection of the ended
// session. Usage: GATEWAY_URL=http://localhost:3000 npm run smoke:auth
import { randomBytes } from 'node:crypto';

const gateway = process.env.GATEWAY_URL ?? 'http://localhost:3000';
const origin = process.env.SMOKE_ORIGIN ?? 'http://localhost:5173';
const email = `smoke-${randomBytes(4).toString('hex')}@example.org`;
const password = `Smoke ${randomBytes(9).toString('base64url')}`;
let failures = 0;

async function call(method, path, { body, cookie } = {}) {
  const headers = { accept: 'application/json', origin };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cookie !== undefined) headers.cookie = cookie;
  const response = await fetch(new URL(path, gateway), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return {
    status: response.status,
    cookie: response.headers.get('set-cookie'),
    body: text.length > 0 ? JSON.parse(text) : undefined,
  };
}

function check(label, condition, detail = '') {
  if (condition) {
    process.stdout.write(`  ok   ${label}\n`);
  } else {
    failures += 1;
    process.stdout.write(`  FAIL ${label} ${detail}\n`);
  }
}

process.stdout.write(`Auth smoke test against ${gateway}\n`);

const health = await call('GET', '/api/health');
check(
  'gateway answers its health check',
  health.status === 200,
  `status=${health.status}`,
);
check(
  'Auth is reachable from the gateway',
  health.body?.upstreams?.auth === 'up',
);

const guestMe = await call('GET', '/api/auth/me');
check(
  'a guest has no account',
  guestMe.status === 401 && guestMe.body?.code === 'UNAUTHENTICATED',
);

const guestWrite = await call('POST', '/api/items', {
  body: { title: 'Draft' },
});
check(
  'a guest cannot submit an item',
  guestWrite.status === 401,
  `status=${guestWrite.status}`,
);

const registered = await call('POST', '/api/auth/register', {
  body: { email, password, displayName: 'Smoke Test' },
});
check(
  'a visitor registers',
  registered.status === 201 && typeof registered.body?.userId === 'string',
  `status=${registered.status}`,
);

const duplicate = await call('POST', '/api/auth/register', {
  body: { email: email.toUpperCase(), password },
});
check(
  'the same email cannot register twice',
  duplicate.status === 409 &&
    duplicate.body?.code === 'EMAIL_ALREADY_REGISTERED',
);

const wrong = await call('POST', '/api/auth/login', {
  body: { email, password: `${password}!` },
});
check(
  'a wrong password is refused',
  wrong.status === 401 && wrong.body?.code === 'INVALID_CREDENTIALS',
);

const login = await call('POST', '/api/auth/login', {
  body: { email, password },
});
const sessionCookie = login.cookie?.split(';')[0];
check(
  'the user logs in',
  login.status === 200 && login.body?.email === email,
  `status=${login.status}`,
);
check(
  'the session cookie is HttpOnly and SameSite=Lax',
  /HttpOnly/.test(login.cookie ?? '') &&
    /SameSite=Lax/.test(login.cookie ?? ''),
);

const me = await call('GET', '/api/auth/me', { cookie: sessionCookie });
check(
  'the signed-in user reads their account',
  me.status === 200 && me.body?.userId === registered.body?.userId,
);

const logout = await call('POST', '/api/auth/logout', {
  cookie: sessionCookie,
});
check('the user logs out', logout.status === 204, `status=${logout.status}`);

const replay = await call('GET', '/api/auth/me', { cookie: sessionCookie });
check(
  'the ended session is rejected',
  replay.status === 401,
  `status=${replay.status}`,
);

process.stdout.write(
  failures === 0
    ? 'All checks passed.\n'
    : `${String(failures)} check(s) failed.\n`,
);
process.exitCode = failures === 0 ? 0 : 1;
