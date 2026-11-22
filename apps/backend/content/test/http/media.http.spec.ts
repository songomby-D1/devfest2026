import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import {
  OTHER_ID,
  OWNER_ID,
  REVIEWER_ID,
  createBody,
  testConfig,
} from '../support/fixtures';
import { InMemoryItemRepository } from '../support/in-memory-item-repository';
import { InMemoryObjectStorage } from '../support/in-memory-object-storage';
import { mp4Bytes, pngBytes } from '../support/media-bytes';
import { createTestApp, gatewayHeaders } from '../support/test-app';

interface MediaRefBody {
  readonly id: string;
  readonly kind: string;
  readonly mimeType: string;
  readonly bytes: number;
  readonly url: string;
  readonly caption: string | null;
}

/** Collects a binary response body as a Buffer. */
function binary(
  response: request.Response,
  callback: (error: Error | null, body: Buffer) => void,
): void {
  const stream = response as unknown as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => {
    chunks.push(chunk);
  });
  stream.on('end', () => {
    callback(null, Buffer.concat(chunks));
  });
}

describe('content-service media HTTP', () => {
  let app: NestExpressApplication;
  let repository: InMemoryItemRepository;
  let storage: InMemoryObjectStorage;
  let itemId: string;

  beforeEach(async () => {
    repository = new InMemoryItemRepository();
    storage = new InMemoryObjectStorage();
    app = await createTestApp(testConfig(), repository, storage);
    const response = await http()
      .post('/internal/v1/items')
      .set(gatewayHeaders(OWNER_ID))
      .send(createBody());
    itemId = (response.body as { id: string }).id;
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const mediaPath = (mediaId = '') =>
    `/internal/v1/items/${itemId}/media${mediaId === '' ? '' : `/${mediaId}`}`;

  function uploadVideo(data = mp4Bytes(1000)) {
    return http()
      .post(mediaPath())
      .set(gatewayHeaders(OWNER_ID))
      .field('caption', 'Weaving')
      .attach('file', data, { filename: 'clip.mp4', contentType: 'video/mp4' });
  }

  describe('POST /internal/v1/items/{id}/media', () => {
    it('answers 201 with a MediaRef and lists it in the item detail', async () => {
      const response = await uploadVideo();

      expect(response.status).toBe(201);
      const media = response.body as MediaRefBody;
      expect(media).toEqual({
        id: expect.any(String) as string,
        kind: 'video',
        mimeType: 'video/mp4',
        bytes: 1000,
        url: `/api/items/${itemId}/media/${media.id}`,
        caption: 'Weaving',
      });

      const detail = await http()
        .get(`/internal/v1/items/${itemId}`)
        .set(gatewayHeaders(OWNER_ID));
      expect(detail.body).toMatchObject({
        media: [media],
        thumbnailUrl: null,
        claims: { item: 'unreviewed' },
      });
    });

    it('uses the first image as the thumbnail', async () => {
      await uploadVideo();
      const image = await http()
        .post(mediaPath())
        .set(gatewayHeaders(OWNER_ID))
        .attach('file', pngBytes(), {
          filename: 'a.png',
          contentType: 'image/png',
        });
      const url = (image.body as MediaRefBody).url;

      const list = await http()
        .get('/internal/v1/items?scope=mine')
        .set(gatewayHeaders(OWNER_ID));
      expect(list.body).toMatchObject({ items: [{ thumbnailUrl: url }] });
    });

    it('answers 415 for a file whose content does not match its type', async () => {
      const response = await http()
        .post(mediaPath())
        .set(gatewayHeaders(OWNER_ID))
        .attach('file', pngBytes(), {
          filename: 'a.mp4',
          contentType: 'video/mp4',
        });

      expect(response.status).toBe(415);
      expect(response.body).toEqual({
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'The file content does not match its type',
        requestId: 'req-123',
      });
      expect(storage.objects.size).toBe(0);
    });

    it('answers 415 for a JSON body', async () => {
      const response = await http()
        .post(mediaPath())
        .set(gatewayHeaders(OWNER_ID))
        .send({ file: 'x' });
      expect(response.status).toBe(415);
      expect(response.body).toMatchObject({ code: 'UNSUPPORTED_MEDIA_TYPE' });
    });

    it('answers 413 for a file over the limit', async () => {
      const response = await uploadVideo(mp4Bytes(9000));
      expect(response.status).toBe(413);
      expect(response.body).toMatchObject({
        code: 'PAYLOAD_TOO_LARGE',
        requestId: 'req-123',
      });
    });

    it('answers 400 without a file', async () => {
      const response = await http()
        .post(mediaPath())
        .set(gatewayHeaders(OWNER_ID))
        .field('caption', 'x');
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        details: [{ field: 'file', reason: 'is required' }],
      });
    });

    it('answers 401 for a guest and 404 for another user', async () => {
      const guest = await http()
        .post(mediaPath())
        .set(gatewayHeaders(null))
        .attach('file', pngBytes(), {
          filename: 'a.png',
          contentType: 'image/png',
        });
      expect(guest.status).toBe(401);
      const other = await http()
        .post(mediaPath())
        .set(gatewayHeaders(OTHER_ID))
        .attach('file', pngBytes(), {
          filename: 'a.png',
          contentType: 'image/png',
        });
      expect(other.status).toBe(404);
    });

    it('answers 409 ITEM_PUBLISHED for a published item', async () => {
      repository.patchRecord(itemId, { publicationStatus: 'published' });
      const response = await uploadVideo();
      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ code: 'ITEM_PUBLISHED' });
    });

    it('answers 400 for an invalid item ID', async () => {
      const response = await http()
        .post('/internal/v1/items/not-a-uuid/media')
        .set(gatewayHeaders(OWNER_ID))
        .attach('file', pngBytes(), {
          filename: 'a.png',
          contentType: 'image/png',
        });
      expect(response.status).toBe(400);
    });

    it('requires the service token', async () => {
      const response = await http()
        .post(mediaPath())
        .set({ 'x-caller-user-id': OWNER_ID })
        .attach('file', pngBytes(), {
          filename: 'a.png',
          contentType: 'image/png',
        });
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ code: 'SERVICE_UNAUTHENTICATED' });
    });
  });

  describe('GET /internal/v1/items/{id}/media/{mediaId}', () => {
    const data = mp4Bytes(1000);
    let mediaId: string;

    beforeEach(async () => {
      mediaId = ((await uploadVideo(data)).body as MediaRefBody).id;
    });

    it('streams the whole file to the owner', async () => {
      const response = await http()
        .get(mediaPath(mediaId))
        .set(gatewayHeaders(OWNER_ID))
        .buffer(true)
        .parse(binary);

      expect(response.status).toBe(200);
      expect(response.headers).toMatchObject({
        'content-type': 'video/mp4',
        'content-length': '1000',
        'accept-ranges': 'bytes',
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      });
      expect(response.body).toEqual(data);
    });

    it('answers 206 for a byte range', async () => {
      const response = await http()
        .get(mediaPath(mediaId))
        .set({
          ...gatewayHeaders(REVIEWER_ID, ['reviewer']),
          range: 'bytes=-10',
        })
        .buffer(true)
        .parse(binary);

      expect(response.status).toBe(206);
      expect(response.headers['content-range']).toBe('bytes 990-999/1000');
      expect(response.body).toEqual(data.subarray(990));
    });

    it('answers 416 in the public error shape', async () => {
      const response = await http()
        .get(mediaPath(mediaId))
        .set({ ...gatewayHeaders(OWNER_ID), range: 'bytes=2000-' });

      expect(response.status).toBe(416);
      expect(response.headers['content-range']).toBe('bytes */1000');
      expect(response.body).toEqual({
        code: 'RANGE_NOT_SATISFIABLE',
        message: 'The requested range is outside the file',
        requestId: 'req-123',
      });
    });

    it('answers 404 to a guest for a draft and serves a published item', async () => {
      const hidden = await http()
        .get(mediaPath(mediaId))
        .set(gatewayHeaders(null));
      expect(hidden.status).toBe(404);
      expect(hidden.body).toMatchObject({ code: 'NOT_FOUND' });

      repository.patchRecord(itemId, { publicationStatus: 'published' });
      const shown = await http()
        .get(mediaPath(mediaId))
        .set(gatewayHeaders(null))
        .buffer(true)
        .parse(binary);
      expect(shown.status).toBe(200);
      expect(shown.headers['cache-control']).toBe(
        'public, max-age=3600, immutable',
      );
    });

    it('answers 304 for a matching ETag', async () => {
      const first = await http()
        .get(mediaPath(mediaId))
        .set(gatewayHeaders(OWNER_ID))
        .buffer(true)
        .parse(binary);
      const etag = String(first.headers.etag);
      const second = await http()
        .get(mediaPath(mediaId))
        .set({ ...gatewayHeaders(OWNER_ID), 'if-none-match': etag });
      expect(second.status).toBe(304);
    });
  });

  describe('PUT and DELETE /internal/v1/items/{id}/media/{mediaId}', () => {
    it('replaces then removes a media', async () => {
      const first = (await uploadVideo()).body as MediaRefBody;

      const replaced = await http()
        .put(mediaPath(first.id))
        .set(gatewayHeaders(OWNER_ID))
        .attach('file', pngBytes(), {
          filename: 'b.png',
          contentType: 'image/png',
        });
      expect(replaced.status).toBe(200);
      const second = replaced.body as MediaRefBody;
      expect(second).toMatchObject({ kind: 'image', caption: 'Weaving' });

      const old = await http()
        .get(mediaPath(first.id))
        .set(gatewayHeaders(OWNER_ID));
      expect(old.status).toBe(404);

      const removed = await http()
        .delete(mediaPath(second.id))
        .set(gatewayHeaders(OWNER_ID));
      expect(removed.status).toBe(204);
      expect(storage.objects.size).toBe(0);

      const again = await http()
        .delete(mediaPath(second.id))
        .set(gatewayHeaders(OWNER_ID));
      expect(again.status).toBe(404);
    });
  });
});
