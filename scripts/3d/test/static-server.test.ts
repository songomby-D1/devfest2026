import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  resolveRequestPath,
  startStaticServer,
  type StaticServer,
  type StaticServerContent,
} from '../src/static-server.ts';

const CONTENT: StaticServerContent = {
  files: new Map([['/page.html', import.meta.filename]]),
  directories: new Map([['/lib/', import.meta.dirname]]),
};

describe('resolveRequestPath', () => {
  it('maps exact files and files under a mounted directory', () => {
    assert.equal(
      resolveRequestPath(CONTENT, '/page.html'),
      import.meta.filename,
    );
    assert.equal(
      resolveRequestPath(CONTENT, '/lib/static-server.test.ts'),
      import.meta.filename,
    );
  });

  it('refuses unmapped paths and escapes from a mounted directory', () => {
    assert.equal(resolveRequestPath(CONTENT, '/other.html'), undefined);
    assert.equal(
      resolveRequestPath(CONTENT, '/lib/../package.json'),
      undefined,
    );
    assert.equal(resolveRequestPath(CONTENT, '/lib/..'), undefined);
  });
});

describe('startStaticServer', () => {
  let server: StaticServer;

  before(async () => {
    server = await startStaticServer(CONTENT);
  });

  after(async () => {
    await server.close();
  });

  it('listens on the loopback interface only', () => {
    assert.match(server.origin, /^http:\/\/127\.0\.0\.1:\d+$/);
  });

  it('serves mapped files and rejects the rest', async () => {
    const served = await fetch(`${server.origin}/page.html`);
    assert.equal(served.status, 200);
    assert.match(await served.text(), /startStaticServer/);

    const encodedEscape = await fetch(
      `${server.origin}/lib/%2e%2e/package.json`,
    );
    assert.equal(encodedEscape.status, 404);
    assert.equal((await fetch(`${server.origin}/lib/`)).status, 404);
    const post = await fetch(`${server.origin}/page.html`, { method: 'POST' });
    assert.equal(post.status, 405);
  });
});
