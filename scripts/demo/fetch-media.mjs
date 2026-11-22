#!/usr/bin/env node
// Downloads the public-domain / CC0 demo images listed in items.json from Wikimedia
// Commons into scripts/demo/media/ (gitignored: media stays out of Git until cleared
// under D18). Usage: node scripts/demo/fetch-media.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { root } from './lib.mjs';

const here = join(root, 'scripts', 'demo');
const dir = join(here, 'media');
mkdirSync(dir, { recursive: true });
const works = JSON.parse(readFileSync(join(here, 'items.json'), 'utf8'));
// Wikimedia throttles requests that do not identify a contact point (HTTP 429).
const headers = {
  'user-agent':
    'lova-demo-seed/0.1 (https://github.com/songomby-D1/devfest2026; demo seeding)',
};

async function get(url) {
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(url, { headers });
    if (response.ok) return response;
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === 5) {
      throw new Error(`${url}: HTTP ${response.status}`);
    }
    const wait = 2000 * 2 ** (attempt - 1);
    process.stdout.write(
      `  ..   retry ${attempt} in ${wait / 1000}s (HTTP ${response.status})\n`,
    );
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

for (const work of works) {
  const target = join(dir, work.file);
  if (existsSync(target)) {
    process.stdout.write(`  have ${work.file}\n`);
    continue;
  }
  const title = decodeURIComponent(work.source.split('/wiki/')[1]);
  const info = new URL('https://commons.wikimedia.org/w/api.php');
  info.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: '1920',
    titles: title,
  }).toString();
  const page = Object.values((await (await get(info)).json()).query.pages)[0];
  const url = page.imageinfo[0].thumburl ?? page.imageinfo[0].url;
  const response = await get(url);
  writeFileSync(target, Buffer.from(await response.arrayBuffer()));
  process.stdout.write(`  got  ${work.file} (${work.license})\n`);
}
