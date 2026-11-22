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
const headers = { 'user-agent': 'lova-demo-seed/0.1' };

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
  const page = Object.values(
    (await (await fetch(info, { headers })).json()).query.pages,
  )[0];
  const url = page.imageinfo[0].thumburl ?? page.imageinfo[0].url;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${work.file}: HTTP ${response.status}`);
  writeFileSync(target, Buffer.from(await response.arrayBuffer()));
  process.stdout.write(`  got  ${work.file} (${work.license})\n`);
}
