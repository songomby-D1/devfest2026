#!/usr/bin/env node
// Seeds the local demo through the real gateway, like a user would: a contributor submits
// five public-domain Malagasy works with their image, a reviewer records the item and
// description claims separately (MVP section B), then publishes them.
// Images: node scripts/demo/fetch-media.mjs (downloaded into scripts/demo/media, gitignored).
// Usage: node scripts/demo/seed.mjs   (GATEWAY_URL defaults to http://localhost:3000)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  api,
  demoAccounts,
  root,
  rootEnv,
  section,
  session,
  check,
  finish,
} from './lib.mjs';

const here = join(root, 'scripts', 'demo');
const works = JSON.parse(readFileSync(join(here, 'items.json'), 'utf8'));
const accounts = demoAccounts();

section('Accounts');
const contributor = await session(
  accounts.contributor.email,
  accounts.contributor.password,
  accounts.contributor.displayName,
);
check(
  `contributor ${accounts.contributor.email} signed in`,
  Boolean(contributor),
);

await session(
  accounts.reviewer.email,
  accounts.reviewer.password,
  accounts.reviewer.displayName,
);
const grant = await api('PUT', '/api/admin/permissions', {
  headers: { 'x-admin-token': rootEnv.get('GATEWAY_ADMIN_TOKEN') ?? '' },
  body: { email: accounts.reviewer.email, permission: 'reviewer' },
});
check(
  'operator grants the reviewer permission',
  grant.status === 204,
  `status=${grant.status}`,
);
// Sign in again so the session carries the new permission.
const reviewer = await session(
  accounts.reviewer.email,
  accounts.reviewer.password,
  accounts.reviewer.displayName,
);

const mine = await api('GET', '/api/items?scope=mine&limit=50', {
  cookie: contributor,
});
const existing = new Map(
  (mine.body?.items ?? []).map((item) => [item.title, item]),
);

const seeded = [];
for (const work of works) {
  section(work.item.title);
  let id = existing.get(work.item.title)?.id;
  if (id) {
    check('already submitted, reusing it', true);
  } else {
    const created = await api('POST', '/api/items', {
      cookie: contributor,
      body: work.item,
    });
    if (
      !check(
        'contributor submits the item',
        created.status === 201,
        `${created.status} ${JSON.stringify(created.body)}`,
      )
    )
      continue;
    id = created.body.id;

    const form = new FormData();
    form.append('caption', work.caption);
    form.append(
      'file',
      new Blob([readFileSync(join(here, 'media', work.file))], {
        type: 'image/jpeg',
      }),
      work.file,
    );
    const media = await api('POST', `/api/items/${id}/media`, {
      cookie: contributor,
      body: form,
    });
    check(
      'contributor uploads the image',
      media.status === 201,
      `${media.status} ${JSON.stringify(media.body)}`,
    );
  }

  const detail = await api('GET', `/api/items/${id}`, { cookie: reviewer });
  if (detail.body?.publicationStatus !== 'published') {
    for (const target of ['item', 'description']) {
      if (
        detail.body?.claims?.[target] &&
        detail.body.claims[target] !== 'unreviewed'
      )
        continue;
      const [outcome, rationale] = work.review[target];
      const review = await api('POST', `/api/items/${id}/review`, {
        cookie: reviewer,
        body: { target, outcome, rationale, evidence: [work.source] },
      });
      check(
        `reviewer marks the ${target} claim ${outcome}`,
        review.status === 201,
        `${review.status} ${JSON.stringify(review.body)}`,
      );
    }
    const publish = await api('POST', `/api/items/${id}/decision`, {
      cookie: reviewer,
      body: {
        decision: 'publish',
        note: 'Rights and claims reviewed for the local demo.',
      },
    });
    check(
      'reviewer publishes it',
      publish.status === 200,
      `${publish.status} ${JSON.stringify(publish.body)}`,
    );
  } else {
    check('already published', true);
  }
  seeded.push({ id, title: work.item.title });
}

section('Public gallery');
const gallery = await api('GET', '/api/items');
const titles = new Set((gallery.body?.items ?? []).map((item) => item.title));
check(
  `a guest sees the ${works.length} published works`,
  works.every((work) => titles.has(work.item.title)),
  JSON.stringify([...titles]),
);
for (const item of seeded)
  process.stdout.write(`  ${item.id}  ${item.title}\n`);
finish();
