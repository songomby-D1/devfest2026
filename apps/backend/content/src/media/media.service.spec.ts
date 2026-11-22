import { buffer } from 'node:stream/consumers';
import {
  OTHER,
  OWNER,
  REVIEWER,
  GUEST,
  testConfig,
} from '../../test/support/fixtures';
import { InMemoryItemRepository } from '../../test/support/in-memory-item-repository';
import { InMemoryObjectStorage } from '../../test/support/in-memory-object-storage';
import {
  jpegBytes,
  mp4Bytes,
  pngBytes,
  webmBytes,
  webpBytes,
} from '../../test/support/media-bytes';
import {
  type Part,
  filePart,
  uploadSource,
} from '../../test/support/multipart';
import { PublicError } from '../common/public-error';
import type { ItemRecord } from '../items/item';
import {
  MediaService,
  PRIVATE_CACHE_CONTROL,
  PUBLISHED_CACHE_CONTROL,
} from './media.service';

const NO_RANGE = {
  range: undefined,
  ifRange: undefined,
  ifNoneMatch: undefined,
  headOnly: false,
};

async function codeOf(
  promise: Promise<unknown>,
): Promise<{ code: string; status: number }> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof PublicError) {
      return { code: error.code, status: error.getStatus() };
    }
    throw error;
  }
  throw new Error('Expected a PublicError');
}

describe('MediaService', () => {
  let repository: InMemoryItemRepository;
  let storage: InMemoryObjectStorage;
  let service: MediaService;
  let item: ItemRecord;

  beforeEach(async () => {
    repository = new InMemoryItemRepository();
    storage = new InMemoryObjectStorage();
    service = new MediaService(repository, storage, testConfig());
    item = await repository.create({
      ownerId: OWNER.userId ?? '',
      metadata: { title: 'Sobika', kind: 'object', origin: null, period: null },
      author: { name: null, community: null, technique: null },
      rights: { statement: 'Mine', confirmed: true },
      descriptionText: 'A woven basket.',
    });
    repository.patchRecord(item.id, {
      claimStatus: 'verified',
      description: { text: 'A woven basket.', claimStatus: 'verified' },
    });
  });

  const upload = (parts: readonly Part[], caller = OWNER) =>
    service.upload(caller, item.id, uploadSource(parts));
  const current = () => repository.items.get(item.id) as ItemRecord;

  describe('upload', () => {
    it.each([
      ['image/jpeg', jpegBytes(), 'image'],
      ['image/png', pngBytes(), 'image'],
      ['image/webp', webpBytes(), 'image'],
      ['video/mp4', mp4Bytes(), 'video'],
      ['video/webm', webmBytes(), 'video'],
    ] as const)(
      'stores a %s file and returns its MediaRef',
      async (type, data, kind) => {
        const media = await upload([
          filePart(data, type),
          { name: 'caption', value: '  Front view ' },
        ]);

        expect(media).toEqual({
          id: expect.any(String) as string,
          kind,
          mimeType: type,
          bytes: data.length,
          url: `/api/items/${item.id}/media/${media.id}`,
          caption: 'Front view',
        });
        const record = current().media[0];
        expect(record).toMatchObject({ position: 0, contentType: type });
        expect(record?.storageKey).toBe(`items/${item.id}/${media.id}`);
        expect(record?.sha256).toMatch(/^[0-9a-f]{64}$/);
        expect(storage.objects.get(record?.storageKey ?? '')?.data).toEqual(
          data,
        );
      },
    );

    it('resets the item claim and keeps the description claim (D18)', async () => {
      await upload([filePart(pngBytes(), 'image/png')]);
      expect(current().claimStatus).toBe('unreviewed');
      expect(current().description.claimStatus).toBe('verified');
    });

    it('appends in order and stores an empty caption as null', async () => {
      const first = await upload([filePart(pngBytes(), 'image/png')]);
      const second = await upload([
        filePart(mp4Bytes(), 'video/mp4'),
        { name: 'caption', value: '   ' },
      ]);
      expect(current().media.map((media) => media.id)).toEqual([
        first.id,
        second.id,
      ]);
      expect(second.caption).toBeNull();
    });

    it.each([
      ['an unlisted type', filePart(Buffer.from('<svg/>'), 'image/svg+xml')],
      ['a generic type', filePart(pngBytes(), 'application/octet-stream')],
      ['a mismatched signature', filePart(pngBytes(), 'image/jpeg')],
      ['a video declared as an image', filePart(mp4Bytes(), 'image/png')],
    ])('refuses %s with 415 and stores nothing', async (_label, part) => {
      await expect(codeOf(upload([part]))).resolves.toEqual({
        code: 'UNSUPPORTED_MEDIA_TYPE',
        status: 415,
      });
      expect(storage.objects.size).toBe(0);
      expect(current().media).toHaveLength(0);
      expect(current().claimStatus).toBe('verified');
    });

    it('applies the image and video size limits separately', async () => {
      // testConfig: 4096 bytes per image, 8192 per video.
      await expect(
        codeOf(upload([filePart(pngBytes(5000), 'image/png')])),
      ).resolves.toEqual({ code: 'PAYLOAD_TOO_LARGE', status: 413 });
      await expect(
        upload([filePart(mp4Bytes(5000), 'video/mp4')]),
      ).resolves.toMatchObject({ bytes: 5000 });
      await expect(
        codeOf(upload([filePart(mp4Bytes(9000), 'video/mp4')])),
      ).resolves.toEqual({ code: 'PAYLOAD_TOO_LARGE', status: 413 });
    });

    it('refuses a caption over 300 characters', async () => {
      await expect(
        codeOf(
          upload([
            filePart(pngBytes(), 'image/png'),
            { name: 'caption', value: 'a'.repeat(301) },
          ]),
        ),
      ).resolves.toEqual({ code: 'VALIDATION_FAILED', status: 400 });
      expect(storage.objects.size).toBe(0);
    });

    it('limits the number of media per item', async () => {
      for (let index = 0; index < 3; index += 1) {
        await upload([filePart(pngBytes(), 'image/png')]);
      }
      await expect(
        codeOf(upload([filePart(pngBytes(), 'image/png')])),
      ).resolves.toEqual({ code: 'MEDIA_LIMIT_REACHED', status: 409 });
      expect(storage.objects.size).toBe(3);
    });

    it.each([
      ['a guest', GUEST, 'UNAUTHENTICATED', 401],
      ['another user', OTHER, 'NOT_FOUND', 404],
      ['a reviewer', REVIEWER, 'FORBIDDEN', 403],
    ] as const)('refuses %s', async (_label, caller, code, status) => {
      await expect(
        codeOf(upload([filePart(pngBytes(), 'image/png')], caller)),
      ).resolves.toEqual({ code, status });
    });

    it('refuses a published item with 409 and an unknown item with 404', async () => {
      repository.patchRecord(item.id, { publicationStatus: 'published' });
      await expect(
        codeOf(upload([filePart(pngBytes(), 'image/png')])),
      ).resolves.toEqual({ code: 'ITEM_PUBLISHED', status: 409 });
      await expect(
        codeOf(
          service.upload(
            OWNER,
            '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f',
            uploadSource([filePart(pngBytes(), 'image/png')]),
          ),
        ),
      ).resolves.toEqual({ code: 'NOT_FOUND', status: 404 });
    });

    it('allows changes to an unpublished item', async () => {
      repository.patchRecord(item.id, { publicationStatus: 'unpublished' });
      await expect(
        upload([filePart(pngBytes(), 'image/png')]),
      ).resolves.toMatchObject({ kind: 'image' });
    });

    it('deletes the new object when the item is published during the upload', async () => {
      const write = storage.write.bind(storage);
      storage.write = async (...args) => {
        await write(...args);
        repository.patchRecord(item.id, { publicationStatus: 'published' });
      };
      await expect(
        codeOf(upload([filePart(pngBytes(), 'image/png')])),
      ).resolves.toEqual({ code: 'ITEM_PUBLISHED', status: 409 });
      expect(storage.objects.size).toBe(0);
      expect(current().media).toHaveLength(0);
    });

    it('answers 503 when storage is unavailable and records nothing', async () => {
      storage.unavailable = true;
      await expect(
        codeOf(upload([filePart(pngBytes(), 'image/png')])),
      ).resolves.toEqual({ code: 'STORAGE_UNAVAILABLE', status: 503 });
      expect(current().media).toHaveLength(0);
    });
  });

  describe('replace and remove', () => {
    it('replaces a media at its position with a new ID and object', async () => {
      const first = await upload([
        filePart(pngBytes(), 'image/png'),
        { name: 'caption', value: 'Front' },
      ]);
      const second = await upload([filePart(pngBytes(), 'image/png')]);
      const oldKey = current().media[0]?.storageKey ?? '';
      repository.patchRecord(item.id, { claimStatus: 'verified' });

      const replaced = await service.replace(
        OWNER,
        item.id,
        first.id,
        uploadSource([filePart(mp4Bytes(), 'video/mp4')]),
      );

      expect(replaced).toMatchObject({ kind: 'video', caption: 'Front' });
      expect(replaced.id).not.toBe(first.id);
      expect(current().media.map((media) => media.id)).toEqual([
        replaced.id,
        second.id,
      ]);
      expect(current().media[0]?.position).toBe(0);
      expect(storage.objects.has(oldKey)).toBe(false);
      expect(storage.objects.size).toBe(2);
      expect(current().claimStatus).toBe('unreviewed');
    });

    it('replaces the caption when a new one is sent', async () => {
      const first = await upload([
        filePart(pngBytes(), 'image/png'),
        { name: 'caption', value: 'Front' },
      ]);
      const replaced = await service.replace(
        OWNER,
        item.id,
        first.id,
        uploadSource([
          filePart(jpegBytes(), 'image/jpeg'),
          { name: 'caption', value: 'Back' },
        ]),
      );
      expect(replaced.caption).toBe('Back');
    });

    it('allows a replacement when the item is full', async () => {
      const ids: string[] = [];
      for (let index = 0; index < 3; index += 1) {
        ids.push((await upload([filePart(pngBytes(), 'image/png')])).id);
      }
      await expect(
        service.replace(
          OWNER,
          item.id,
          ids[1] ?? '',
          uploadSource([filePart(pngBytes(), 'image/png')]),
        ),
      ).resolves.toMatchObject({ kind: 'image' });
    });

    it('answers 404 for an unknown media', async () => {
      await expect(
        codeOf(
          service.replace(
            OWNER,
            item.id,
            '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f',
            uploadSource([filePart(pngBytes(), 'image/png')]),
          ),
        ),
      ).resolves.toEqual({ code: 'NOT_FOUND', status: 404 });
      await expect(
        codeOf(
          service.remove(
            OWNER,
            item.id,
            '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f',
          ),
        ),
      ).resolves.toEqual({ code: 'NOT_FOUND', status: 404 });
    });

    it('removes a media, its object, and resets the item claim', async () => {
      const media = await upload([filePart(pngBytes(), 'image/png')]);
      repository.patchRecord(item.id, { claimStatus: 'uncertain' });

      await service.remove(OWNER, item.id, media.id);

      expect(current().media).toHaveLength(0);
      expect(storage.objects.size).toBe(0);
      expect(current().claimStatus).toBe('unreviewed');
    });

    it('keeps the removal when the object cannot be deleted', async () => {
      const media = await upload([filePart(pngBytes(), 'image/png')]);
      storage.failDeletes = true;
      await service.remove(OWNER, item.id, media.id);
      expect(current().media).toHaveLength(0);
    });

    it('refuses changes on a published item and by others', async () => {
      const media = await upload([filePart(pngBytes(), 'image/png')]);
      await expect(
        codeOf(service.remove(REVIEWER, item.id, media.id)),
      ).resolves.toEqual({ code: 'FORBIDDEN', status: 403 });
      repository.patchRecord(item.id, { publicationStatus: 'published' });
      await expect(
        codeOf(service.remove(OWNER, item.id, media.id)),
      ).resolves.toEqual({ code: 'ITEM_PUBLISHED', status: 409 });
      await expect(
        codeOf(
          service.replace(
            OWNER,
            item.id,
            media.id,
            uploadSource([filePart(pngBytes(), 'image/png')]),
          ),
        ),
      ).resolves.toEqual({ code: 'ITEM_PUBLISHED', status: 409 });
      expect(current().media).toHaveLength(1);
    });
  });

  describe('deliver', () => {
    let mediaId: string;
    const data = mp4Bytes(1000);

    beforeEach(async () => {
      mediaId = (await upload([filePart(data, 'video/mp4')])).id;
    });

    it('streams a draft to its owner and reviewers without caching', async () => {
      for (const caller of [OWNER, REVIEWER]) {
        const delivery = await service.deliver(
          caller,
          item.id,
          mediaId,
          NO_RANGE,
        );
        expect(delivery).toMatchObject({
          kind: 'content',
          status: 200,
          headers: {
            'content-type': 'video/mp4',
            'content-length': '1000',
            'accept-ranges': 'bytes',
            'cache-control': PRIVATE_CACHE_CONTROL,
            'x-content-type-options': 'nosniff',
          },
        });
        if (delivery.kind !== 'content' || delivery.body === null)
          throw new Error();
        await expect(buffer(delivery.body)).resolves.toEqual(data);
      }
    });

    it('hides a draft from guests and other users', async () => {
      for (const caller of [GUEST, OTHER]) {
        await expect(
          codeOf(service.deliver(caller, item.id, mediaId, NO_RANGE)),
        ).resolves.toEqual({ code: 'NOT_FOUND', status: 404 });
      }
    });

    it('serves a published item to guests with immutable caching', async () => {
      repository.patchRecord(item.id, { publicationStatus: 'published' });
      const delivery = await service.deliver(GUEST, item.id, mediaId, NO_RANGE);
      expect(delivery).toMatchObject({
        status: 200,
        headers: { 'cache-control': PUBLISHED_CACHE_CONTROL },
      });
    });

    it('serves a byte range with 206', async () => {
      const delivery = await service.deliver(OWNER, item.id, mediaId, {
        ...NO_RANGE,
        range: 'bytes=100-199',
      });
      expect(delivery).toMatchObject({
        status: 206,
        headers: {
          'content-range': 'bytes 100-199/1000',
          'content-length': '100',
        },
      });
      if (delivery.kind !== 'content' || delivery.body === null)
        throw new Error();
      await expect(buffer(delivery.body)).resolves.toEqual(
        data.subarray(100, 200),
      );
    });

    it('reports an unsatisfiable range', async () => {
      await expect(
        service.deliver(OWNER, item.id, mediaId, {
          ...NO_RANGE,
          range: 'bytes=5000-',
        }),
      ).resolves.toEqual({
        kind: 'unsatisfiable',
        size: 1000,
        cacheControl: PRIVATE_CACHE_CONTROL,
      });
    });

    it('ignores the range when If-Range does not match', async () => {
      const delivery = await service.deliver(OWNER, item.id, mediaId, {
        ...NO_RANGE,
        range: 'bytes=0-9',
        ifRange: '"stale"',
      });
      expect(delivery).toMatchObject({ status: 200 });
    });

    it('answers 304 when the ETag matches', async () => {
      const first = await service.deliver(OWNER, item.id, mediaId, NO_RANGE);
      if (first.kind !== 'content') throw new Error();
      const etag = first.headers.etag ?? '';
      expect(etag).toMatch(/^"[0-9a-f]{64}"$/);
      const second = await service.deliver(OWNER, item.id, mediaId, {
        ...NO_RANGE,
        ifNoneMatch: `"other", W/${etag}`,
      });
      expect(second).toMatchObject({ status: 304, body: null });
    });

    it('answers HEAD without a body', async () => {
      const delivery = await service.deliver(OWNER, item.id, mediaId, {
        ...NO_RANGE,
        headOnly: true,
      });
      expect(delivery).toMatchObject({ status: 200, body: null });
    });

    it('answers 404 for a media of another item or a missing object', async () => {
      const other = await repository.create({
        ownerId: OWNER.userId ?? '',
        metadata: {
          title: 'Other',
          kind: 'object',
          origin: null,
          period: null,
        },
        author: { name: null, community: null, technique: null },
        rights: { statement: 'Mine', confirmed: true },
        descriptionText: 'Other.',
      });
      await expect(
        codeOf(service.deliver(OWNER, other.id, mediaId, NO_RANGE)),
      ).resolves.toEqual({ code: 'NOT_FOUND', status: 404 });
      storage.objects.clear();
      await expect(
        codeOf(service.deliver(OWNER, item.id, mediaId, NO_RANGE)),
      ).resolves.toEqual({ code: 'NOT_FOUND', status: 404 });
    });

    it('answers 503 when storage is unavailable', async () => {
      storage.unavailable = true;
      await expect(
        codeOf(service.deliver(OWNER, item.id, mediaId, NO_RANGE)),
      ).resolves.toEqual({ code: 'STORAGE_UNAVAILABLE', status: 503 });
    });
  });
});
