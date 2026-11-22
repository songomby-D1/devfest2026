import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  NFT_TOKEN,
  OTHER_ID,
  OWNER_ID,
  REVIEWER_ID,
  createBody,
  testConfig,
} from '../support/fixtures';
import { InMemoryObjectStorage } from '../support/in-memory-object-storage';
import { mp4Bytes, pngBytes } from '../support/media-bytes';
import { createTestApp, gatewayHeaders } from '../support/test-app';

const POSTGRES_IMAGE = 'postgres:18.6';
const SERVICE_ROOT = join(__dirname, '..', '..');
// Resolved through Node because the root workspace may hoist prisma out of the service.
const PRISMA_CLI = join(
  dirname(require.resolve('prisma/package.json')),
  'build',
  'index.js',
);
const DATABASE = 'content';

jest.setTimeout(180_000);

/**
 * Mirrors INFRA-01 (D04): a migration role that owns the database and a
 * runtime role limited to data access. The application runs as the latter.
 * Each statement runs on its own, since CREATE DATABASE refuses transactions.
 */
const SERVER_STATEMENTS = [
  "CREATE ROLE content_migrator LOGIN PASSWORD 'migrator-pw'",
  "CREATE ROLE content_runtime LOGIN PASSWORD 'runtime-pw'",
  `CREATE DATABASE ${DATABASE} OWNER content_migrator`,
  `REVOKE ALL ON DATABASE ${DATABASE} FROM PUBLIC`,
  `GRANT CONNECT, TEMPORARY ON DATABASE ${DATABASE} TO content_runtime`,
];
const DATABASE_STATEMENTS = [
  'GRANT USAGE ON SCHEMA public TO content_runtime',
  'ALTER DEFAULT PRIVILEGES FOR ROLE content_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO content_runtime',
  'ALTER DEFAULT PRIVILEGES FOR ROLE content_migrator IN SCHEMA public GRANT USAGE ON TYPES TO content_runtime',
];

async function runSql(
  container: StartedPostgreSqlContainer,
  database: string,
  statements: readonly string[],
): Promise<void> {
  const result = await container.exec([
    'psql',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    container.getUsername(),
    '-d',
    database,
    ...statements.flatMap((statement) => ['-c', statement]),
  ]);
  if (result.exitCode !== 0) throw new Error(`psql failed: ${result.output}`);
}

function urlFor(
  container: StartedPostgreSqlContainer,
  user: string,
  password: string,
): string {
  return `postgresql://${user}:${password}@${container.getHost()}:${String(
    container.getPort(),
  )}/${DATABASE}`;
}

describe('content-service with PostgreSQL (Testcontainers)', () => {
  let container: StartedPostgreSqlContainer;
  let app: NestExpressApplication;
  let prisma: PrismaService;
  // S3 is replaced by the in-memory fake; PostgreSQL is real.
  const storage = new InMemoryObjectStorage();

  beforeAll(async () => {
    container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    await runSql(container, 'postgres', SERVER_STATEMENTS);
    await runSql(container, DATABASE, DATABASE_STATEMENTS);

    await promisify(execFile)(
      process.execPath,
      [PRISMA_CLI, 'migrate', 'deploy'],
      {
        cwd: SERVICE_ROOT,
        env: {
          ...process.env,
          MIGRATION_DATABASE_URL: urlFor(
            container,
            'content_migrator',
            'migrator-pw',
          ),
        },
      },
    );

    app = await createTestApp(
      testConfig(urlFor(container, 'content_runtime', 'runtime-pw')),
      undefined,
      storage,
    );
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
    await container.stop();
  });

  const http = () => request(app.getHttpServer());

  it('creates the author, item and description in one write', async () => {
    const response = await http()
      .post('/internal/v1/items')
      .set(gatewayHeaders(OWNER_ID))
      .send(createBody());
    expect(response.status).toBe(201);
    const id = (response.body as { id: string }).id;

    const row = await prisma.item.findUniqueOrThrow({
      where: { id },
      include: { author: true, description: true },
    });
    expect(row).toMatchObject({
      ownerId: OWNER_ID,
      title: 'Lamba mena',
      kind: 'textile',
      publicationStatus: 'draft',
      submissionStatus: 'in_review',
      claimStatus: 'unreviewed',
      author: { name: 'Rasoa', community: 'Merina weavers' },
      description: {
        text: 'A silk burial shroud woven in the highlands.',
        claimStatus: 'unreviewed',
      },
    });

    const read = await http()
      .get(`/internal/v1/items/${id}`)
      .set(gatewayHeaders(OWNER_ID));
    expect(read.status).toBe(200);
    expect(read.body).toEqual(response.body);
  });

  it('stores nothing when the input is invalid', async () => {
    const before = await prisma.author.count();

    const response = await http()
      .post('/internal/v1/items')
      .set(gatewayHeaders(OWNER_ID))
      .send(createBody({ description: '' }));

    expect(response.status).toBe(400);
    expect(await prisma.author.count()).toBe(before);
  });

  it('hides a draft from other users and shows it once published', async () => {
    const created = await http()
      .post('/internal/v1/items')
      .set(gatewayHeaders(OWNER_ID))
      .send(createBody());
    const id = (created.body as { id: string }).id;

    const hidden = await http()
      .get(`/internal/v1/items/${id}`)
      .set(gatewayHeaders(OTHER_ID));
    expect(hidden.status).toBe(404);

    await prisma.item.update({
      where: { id },
      data: { publicationStatus: 'published' },
    });
    const guest = await http()
      .get(`/internal/v1/items/${id}`)
      .set(gatewayHeaders(null));
    expect(guest.status).toBe(200);
  });

  it('reopens the changed claims on edit and refuses edits once published', async () => {
    const created = await http()
      .post('/internal/v1/items')
      .set(gatewayHeaders(OWNER_ID))
      .send(createBody());
    const id = (created.body as { id: string }).id;
    await prisma.item.update({
      where: { id },
      data: {
        claimStatus: 'verified',
        description: { update: { claimStatus: 'uncertain' } },
      },
    });

    const edited = await http()
      .patch(`/internal/v1/items/${id}`)
      .set(gatewayHeaders(OWNER_ID))
      .send({ description: 'Corrected description.', technique: null });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({
      description: 'Corrected description.',
      creator: { technique: null },
      claims: { item: 'unreviewed', description: 'unreviewed' },
    });
    const editedAt = (edited.body as { updatedAt: string }).updatedAt;
    expect(Date.parse(editedAt)).toBeGreaterThan(
      Date.parse((created.body as { updatedAt: string }).updatedAt),
    );

    await prisma.item.update({
      where: { id },
      data: { publicationStatus: 'published' },
    });
    const refused = await http()
      .patch(`/internal/v1/items/${id}`)
      .set(gatewayHeaders(OWNER_ID))
      .send({ title: 'Another title' });
    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({ code: 'ITEM_PUBLISHED' });
    expect((await prisma.item.findUniqueOrThrow({ where: { id } })).title).toBe(
      'Lamba mena',
    );
  });

  async function submitAs(
    ownerId: string,
    overrides: Record<string, unknown> = {},
  ): Promise<string> {
    const response = await http()
      .post('/internal/v1/items')
      .set(gatewayHeaders(ownerId))
      .send(createBody(overrides));
    expect(response.status).toBe(201);
    return (response.body as { id: string }).id;
  }

  async function markReviewed(id: string): Promise<void> {
    await prisma.item.update({
      where: { id },
      data: {
        claimStatus: 'verified',
        description: { update: { claimStatus: 'uncertain' } },
      },
    });
  }

  const reviewer = () => gatewayHeaders(REVIEWER_ID, ['reviewer']);

  it('publishes, unpublishes and republishes with a recorded history', async () => {
    const id = await submitAs(OWNER_ID);
    await markReviewed(id);

    const published = await http()
      .post(`/internal/v1/items/${id}/decision`)
      .set(reviewer())
      .send({ decision: 'publish', note: 'Sources checked' });
    expect(published.status).toBe(200);
    expect(published.body).toMatchObject({
      publicationStatus: 'published',
      submissionStatus: 'accepted',
    });

    const lookup = await http()
      .get(`/internal/v1/items/${id}/publication`)
      .set({ 'x-service-name': 'nft', 'x-service-token': NFT_TOKEN });
    expect(lookup.body).toEqual({
      contentId: id,
      publicationStatus: 'published',
    });

    await http()
      .post(`/internal/v1/items/${id}/unpublish`)
      .set(reviewer())
      .send({ note: 'Rights dispute' })
      .expect(200);
    const hidden = await http()
      .get(`/internal/v1/items/${id}`)
      .set(gatewayHeaders(null));
    expect(hidden.status).toBe(404);

    // An edit while unpublished reopens the claim, so republishing waits for
    // a new review (D18).
    await http()
      .patch(`/internal/v1/items/${id}`)
      .set(gatewayHeaders(OWNER_ID))
      .send({ title: 'Lamba mena (corrected)' })
      .expect(200);
    const blocked = await http()
      .post(`/internal/v1/items/${id}/decision`)
      .set(reviewer())
      .send({ decision: 'publish', note: '' });
    expect(blocked.status).toBe(422);
    expect(blocked.body).toMatchObject({ code: 'CLAIMS_UNREVIEWED' });

    await markReviewed(id);
    await http()
      .post(`/internal/v1/items/${id}/decision`)
      .set(reviewer())
      .send({ decision: 'publish', note: 'Re-reviewed' })
      .expect(200);

    const events = await prisma.publicationEvent.findMany({
      where: { itemId: id },
      orderBy: { createdAt: 'asc' },
    });
    expect(
      events.map(({ action, actorId, note }) => ({ action, actorId, note })),
    ).toEqual([
      { action: 'publish', actorId: REVIEWER_ID, note: 'Sources checked' },
      { action: 'unpublish', actorId: REVIEWER_ID, note: 'Rights dispute' },
      { action: 'publish', actorId: REVIEWER_ID, note: 'Re-reviewed' },
    ]);
  });

  it('applies concurrent publish decisions once', async () => {
    const id = await submitAs(OWNER_ID);
    await markReviewed(id);

    const responses = await Promise.all(
      [1, 2, 3].map(() =>
        http()
          .post(`/internal/v1/items/${id}/decision`)
          .set(reviewer())
          .send({ decision: 'publish', note: '' }),
      ),
    );

    expect(responses.map((response) => response.status)).toEqual([
      200, 200, 200,
    ]);
    expect(await prisma.publicationEvent.count({ where: { itemId: id } })).toBe(
      1,
    );
  });

  it('pages through own items in a stable order, ties broken by id', async () => {
    const owner = randomUUID();
    const ids = [] as string[];
    for (let index = 0; index < 5; index += 1) ids.push(await submitAs(owner));
    await prisma.item.updateMany({
      where: { ownerId: owner },
      data: { createdAt: new Date('2026-11-22T09:00:00.000Z') },
    });

    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const response = await http()
        .get('/internal/v1/items')
        .query({
          scope: 'mine',
          limit: 2,
          ...(cursor === null ? {} : { cursor }),
        })
        .set(gatewayHeaders(owner));
      expect(response.status).toBe(200);
      const page = response.body as {
        items: { id: string }[];
        nextCursor: string | null;
      };
      seen.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor;
    } while (cursor !== null);

    expect(seen).toEqual([...ids].sort().reverse());
  });

  it('filters published items by kind and literal text, never drafts', async () => {
    const token = `zq${randomUUID().slice(0, 8)}`;
    const published = await submitAs(OWNER_ID, {
      title: `Sobika ${token} 100%`,
      kind: 'object',
    });
    const draft = await submitAs(OWNER_ID, { title: `Sobika ${token} draft` });
    const byAuthor = await submitAs(OWNER_ID, {
      title: 'Untitled',
      creatorName: `Rabe ${token}`,
    });
    await prisma.item.updateMany({
      where: { id: { in: [published, byAuthor] } },
      data: { publicationStatus: 'published' },
    });

    const list = async (query: Record<string, string>) => {
      const response = await http()
        .get('/internal/v1/items')
        .query(query)
        .set(gatewayHeaders(null));
      expect(response.status).toBe(200);
      return (response.body as { items: { id: string }[] }).items.map(
        (item) => item.id,
      );
    };

    expect(await list({ q: token.toUpperCase() })).toEqual([
      byAuthor,
      published,
    ]);
    expect(await list({ q: token, kind: 'object' })).toEqual([published]);
    expect(await list({ q: `${token} 100%` })).toEqual([published]);
    // `%` and `_` are literal characters, not wildcards.
    expect(await list({ q: `${token}%` })).toEqual([]);
    expect(await list({ q: `Sobika_${token}` })).toEqual([]);
    expect(await list({ q: token })).not.toContain(draft);
  });

  it('lists the review queue for reviewers only', async () => {
    const id = await submitAs(OTHER_ID);

    const queue = await http()
      .get('/internal/v1/items?scope=review&limit=50')
      .set(reviewer());
    expect(queue.status).toBe(200);
    expect(
      (queue.body as { items: { id: string; submissionStatus: string }[] })
        .items,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id, submissionStatus: 'in_review' }),
      ]),
    );
    const refused = await http()
      .get('/internal/v1/items?scope=review')
      .set(gatewayHeaders(OTHER_ID));
    expect(refused.status).toBe(403);
  });

  describe('media (CONTENT-03)', () => {
    const attachPng = (id: string, ownerId = OWNER_ID) =>
      http()
        .post(`/internal/v1/items/${id}/media`)
        .set(gatewayHeaders(ownerId))
        .attach('file', pngBytes(), {
          filename: 'photo.png',
          contentType: 'image/png',
        });

    it('records media in order, resets the item claim and serves them', async () => {
      const id = await submitAs(OWNER_ID);
      await markReviewed(id);

      const image = await attachPng(id);
      expect(image.status).toBe(201);
      const video = await http()
        .post(`/internal/v1/items/${id}/media`)
        .set(gatewayHeaders(OWNER_ID))
        .field('caption', 'Weaving')
        .attach('file', mp4Bytes(2000), {
          filename: 'clip.mp4',
          contentType: 'video/mp4',
        });
      expect(video.status).toBe(201);
      const videoId = (video.body as { id: string }).id;

      const rows = await prisma.media.findMany({
        where: { itemId: id },
        orderBy: { position: 'asc' },
      });
      expect(rows.map((row) => [row.kind, row.position, row.caption])).toEqual([
        ['image', 0, null],
        ['video', 1, 'Weaving'],
      ]);
      expect(rows[1]).toMatchObject({
        id: videoId,
        contentType: 'video/mp4',
        bytes: 2000,
        storageKey: `items/${id}/${videoId}`,
      });
      expect(rows[1]?.sha256).toMatch(/^[0-9a-f]{64}$/);
      const item = await prisma.item.findUniqueOrThrow({
        where: { id },
        include: { description: true },
      });
      expect(item.claimStatus).toBe('unreviewed');
      expect(item.description?.claimStatus).toBe('uncertain');

      const detail = await http()
        .get(`/internal/v1/items/${id}`)
        .set(gatewayHeaders(OWNER_ID));
      expect(
        (detail.body as { media: { id: string }[] }).media.map((m) => m.id),
      ).toEqual([(image.body as { id: string }).id, videoId]);

      const range = await http()
        .get(`/internal/v1/items/${id}/media/${videoId}`)
        .set({ ...gatewayHeaders(OWNER_ID), range: 'bytes=0-15' });
      expect(range.status).toBe(206);
      expect(range.headers['content-range']).toBe('bytes 0-15/2000');
    });

    it('replaces at the same position and removes', async () => {
      const id = await submitAs(OWNER_ID);
      const first = (await attachPng(id)).body as { id: string };
      const second = (await attachPng(id)).body as { id: string };

      const replaced = await http()
        .put(`/internal/v1/items/${id}/media/${first.id}`)
        .set(gatewayHeaders(OWNER_ID))
        .attach('file', mp4Bytes(), {
          filename: 'clip.mp4',
          contentType: 'video/mp4',
        });
      expect(replaced.status).toBe(200);
      const rows = await prisma.media.findMany({
        where: { itemId: id },
        orderBy: { position: 'asc' },
      });
      expect(rows.map((row) => [row.id, row.position])).toEqual([
        [(replaced.body as { id: string }).id, 0],
        [second.id, 1],
      ]);

      await http()
        .delete(`/internal/v1/items/${id}/media/${second.id}`)
        .set(gatewayHeaders(OWNER_ID))
        .expect(204);
      expect(await prisma.media.count({ where: { itemId: id } })).toBe(1);
    });

    it('refuses media changes on a published item', async () => {
      const id = await submitAs(OWNER_ID);
      await prisma.item.update({
        where: { id },
        data: { publicationStatus: 'published' },
      });
      const response = await attachPng(id);
      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ code: 'ITEM_PUBLISHED' });
      expect(await prisma.media.count({ where: { itemId: id } })).toBe(0);
    });

    it('keeps the per-item limit under concurrent uploads', async () => {
      const id = await submitAs(OWNER_ID);
      // testConfig allows 3 media per item.
      const responses = await Promise.all(
        [1, 2, 3, 4, 5].map(() => attachPng(id)),
      );
      const statuses = responses.map((response) => response.status).sort();
      expect(statuses).toEqual([201, 201, 201, 409, 409]);
      const rows = await prisma.media.findMany({ where: { itemId: id } });
      expect(rows.map((row) => row.position).sort()).toEqual([0, 1, 2]);
      const keys = new Set(rows.map((row) => row.storageKey));
      const stored = [...storage.objects.keys()].filter((key) =>
        key.startsWith(`items/${id}/`),
      );
      expect(new Set(stored)).toEqual(keys);
    });
  });

  describe('claim review (CONTENT-04)', () => {
    const SECOND_REVIEWER_ID = '9c4d5e6f-7a8b-4c3d-9e4f-5a6b7c8d9e0f';
    const reviewBody = (overrides: Record<string, unknown> = {}) => ({
      target: 'item',
      outcome: 'verified',
      rationale: 'Matches the museum inventory card.',
      evidence: ['Inventory card 1932-14', 'Field notes, 1998'],
      ...overrides,
    });
    const postReview = (
      id: string,
      body: object,
      reviewerId: string = REVIEWER_ID,
    ) =>
      http()
        .post(`/internal/v1/items/${id}/review`)
        .set(gatewayHeaders(reviewerId, ['reviewer']))
        .send(body);
    const decide = (id: string, decision: string, note: string) =>
      http()
        .post(`/internal/v1/items/${id}/decision`)
        .set(reviewer())
        .send({ decision, note });

    it('records both reviews with their history, then publishes', async () => {
      const id = await submitAs(OWNER_ID);

      expect((await postReview(id, reviewBody())).status).toBe(201);
      const second = await postReview(
        id,
        reviewBody({
          target: 'description',
          outcome: 'uncertain',
          evidence: [],
        }),
        SECOND_REVIEWER_ID,
      );
      expect(second.status).toBe(201);
      expect(second.body).toMatchObject({
        claims: { item: 'verified', description: 'uncertain' },
        publicationStatus: 'draft',
      });

      const rows = await prisma.claimReview.findMany({
        where: { itemId: id },
        orderBy: { reviewedAt: 'asc' },
      });
      expect(
        rows.map((row) => ({
          target: row.target,
          fromStatus: row.fromStatus,
          outcome: row.outcome,
          reviewerId: row.reviewerId,
          evidence: row.evidence,
        })),
      ).toEqual([
        {
          target: 'item',
          fromStatus: 'unreviewed',
          outcome: 'verified',
          reviewerId: REVIEWER_ID,
          evidence: ['Inventory card 1932-14', 'Field notes, 1998'],
        },
        {
          target: 'description',
          fromStatus: 'unreviewed',
          outcome: 'uncertain',
          reviewerId: SECOND_REVIEWER_ID,
          evidence: [],
        },
      ]);

      const owner = await http()
        .get(`/internal/v1/items/${id}`)
        .set(gatewayHeaders(OWNER_ID));
      const reviews = (owner.body as { reviews: { target: string }[] }).reviews;
      expect(reviews.map((review) => review.target).sort()).toEqual([
        'description',
        'item',
      ]);

      const published = await decide(id, 'publish', 'Both reviewed');
      expect(published.status).toBe(200);
      expect(published.body).toMatchObject({ publicationStatus: 'published' });
    });

    it('serializes concurrent reviews of one claim under the item lock', async () => {
      const id = await submitAs(OWNER_ID);
      const outcomes = ['verified', 'uncertain', 'verified', 'uncertain'];

      const responses = await Promise.all(
        outcomes.map((outcome) => postReview(id, reviewBody({ outcome }))),
      );
      expect(responses.map((response) => response.status)).toEqual([
        201, 201, 201, 201,
      ]);

      const rows = await prisma.claimReview.findMany({
        where: { itemId: id, target: 'item' },
        orderBy: { reviewedAt: 'asc' },
      });
      expect(rows).toHaveLength(4);
      // Each review starts from the outcome of the one before it.
      rows.forEach((row, index) => {
        expect(row.fromStatus).toBe(
          index === 0 ? 'unreviewed' : rows[index - 1]?.outcome,
        );
      });
      const times = rows.map((row) => row.reviewedAt.getTime());
      expect(new Set(times).size).toBe(4);
      const item = await prisma.item.findUniqueOrThrow({ where: { id } });
      expect(item.claimStatus).toBe(rows.at(-1)?.outcome);
    });

    it('refuses an unreviewed outcome at the database level', async () => {
      const id = await submitAs(OWNER_ID);
      await expect(
        prisma.claimReview.create({
          data: {
            itemId: id,
            target: 'item',
            fromStatus: 'verified',
            outcome: 'unreviewed',
            rationale: 'Reset',
            evidence: [],
            reviewerId: REVIEWER_ID,
            reviewedAt: new Date(),
          },
        }),
      ).rejects.toThrow();
    });

    it('returns, puts back in review on edit or media change, and rejects', async () => {
      const id = await submitAs(OWNER_ID);
      await postReview(id, reviewBody()).expect(201);

      const returned = await decide(id, 'return', 'Add the weaving period');
      expect(returned.body).toMatchObject({ submissionStatus: 'returned' });
      const queued = async () => {
        const page = await http()
          .get('/internal/v1/items?scope=review&limit=50')
          .set(gatewayHeaders(SECOND_REVIEWER_ID, ['reviewer']));
        return (page.body as { items: { id: string }[] }).items.map(
          (item) => item.id,
        );
      };
      expect(await queued()).not.toContain(id);

      // A media change is an edit: back in review, item claim reset.
      const upload = await http()
        .post(`/internal/v1/items/${id}/media`)
        .set(gatewayHeaders(OWNER_ID))
        .attach('file', pngBytes(), {
          filename: 'photo.png',
          contentType: 'image/png',
        });
      expect(upload.status).toBe(201);
      let row = await prisma.item.findUniqueOrThrow({ where: { id } });
      expect(row.submissionStatus).toBe('in_review');
      expect(row.claimStatus).toBe('unreviewed');
      expect(await queued()).toContain(id);

      await decide(id, 'return', 'Still missing the period').expect(200);
      const edited = await http()
        .patch(`/internal/v1/items/${id}`)
        .set(gatewayHeaders(OWNER_ID))
        .send({ period: 'Around 1910' });
      expect(edited.body).toMatchObject({ submissionStatus: 'in_review' });

      await decide(id, 'reject', 'Duplicate of another item').expect(200);
      const refused = await http()
        .patch(`/internal/v1/items/${id}`)
        .set(gatewayHeaders(OWNER_ID))
        .send({ title: 'Another title' });
      expect(refused.status).toBe(409);
      expect(refused.body).toMatchObject({ code: 'SUBMISSION_REJECTED' });
      row = await prisma.item.findUniqueOrThrow({ where: { id } });
      expect(row.submissionStatus).toBe('rejected');
      expect(row.period).toBe('Around 1910');

      const events = await prisma.publicationEvent.findMany({
        where: { itemId: id },
        orderBy: { createdAt: 'asc' },
      });
      expect(events.map((event) => event.action)).toEqual([
        'return',
        'return',
        'reject',
      ]);
    });
  });

  it('runs with a runtime role that cannot change the schema (D04)', async () => {
    await expect(
      prisma.$executeRawUnsafe('DROP TABLE descriptions'),
    ).rejects.toThrow();
  });
});
