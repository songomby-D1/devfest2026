import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { PublicError } from '../common/public-error';
import { AppConfigService } from '../config/app-config.service';
import { ContentReferenceService } from '../content/content-reference.service';
import { IpfsError, jsonBytes, PINNER, type Pinner } from '../ipfs/pinner';
import {
  ContentSnapshotClient,
  type ItemSnapshot,
  type SnapshotMedia,
} from './content-snapshot-client';
import {
  buildMetadata,
  chooseMaster,
  MAX_TITLE_BYTES,
  toContractCategory,
  truncateUtf8,
} from './metadata-builder';
import {
  contentNotMintable,
  contentNotPublished,
  contentUnavailable,
  ipfsUnavailable,
  mediaIntegrityFailed,
  mediaTooLarge,
} from './metadata-errors';
import type {
  MetadataContext,
  MetadataPublisher,
  PreparedMetadata,
} from './metadata-publisher.port';

interface MasterFile {
  readonly sha256: string;
  /** The bytes, kept only for an image, which is also the public preview. */
  readonly bytes: Buffer | null;
}

/**
 * Prepares the public metadata of a published item and pins it (NFT-03,
 * S22). Steps:
 *
 * 1. Publication check through NFT-02 (`assertPublished`), then the item
 *    detail, read as a guest so that only public data comes back.
 * 2. Master file (first image, else first video) streamed from Content,
 *    hashed, and compared with the SHA-256 Content recorded.
 * 3. Public preview: the master image itself, pinned as is (no resizing in
 *    the MVP). An item without an image has no preview.
 * 4. Metadata JSON from public fields only, pinned with a deterministic name.
 *
 * Same snapshot, same bytes, same CIDs: running it again is idempotent.
 */
@Injectable()
export class MetadataService implements MetadataPublisher {
  private readonly logger = new Logger(MetadataService.name);

  constructor(
    @Inject(ContentReferenceService)
    private readonly references: ContentReferenceService,
    @Inject(ContentSnapshotClient)
    private readonly content: ContentSnapshotClient,
    @Inject(PINNER) private readonly pinner: Pinner,
    @Inject(AppConfigService) private readonly config: AppConfigService,
  ) {}

  async prepare(
    contentId: string,
    context: MetadataContext,
  ): Promise<PreparedMetadata> {
    const published = await this.references.assertPublished(contentId, {
      requestId: context.requestId,
    });
    const requestId = published.requestId;
    const id = published.contentId.toLowerCase();

    const item = await this.readItem(id, requestId);
    const title = truncateUtf8(item.title.trim(), MAX_TITLE_BYTES);
    if (title === '') throw contentNotMintable(requestId, 'it has no title');
    const master = chooseMaster(item.media);
    if (master === null) {
      throw contentNotMintable(requestId, 'it has no media file');
    }

    const file = await this.readMaster(id, master, requestId);
    const masterHash = `0x${file.sha256}`;
    const category = toContractCategory(item.kind);

    const imageCid =
      file.bytes === null
        ? null
        : await this.pin(requestId, {
            name: `lova-${id}-preview`,
            bytes: file.bytes,
            contentType: master.mimeType,
            keyvalues: { contentId: id, role: 'preview', sha256: file.sha256 },
          });

    const metadata = buildMetadata({
      item,
      contentId: id,
      category,
      masterHash,
      preview:
        imageCid === null ? null : { cid: imageCid, mimeType: master.mimeType },
    });
    const metadataCid = await this.pin(requestId, {
      name: `lova-${id}-metadata.json`,
      bytes: jsonBytes(metadata),
      contentType: 'application/json',
      keyvalues: { contentId: id, role: 'metadata', masterHash },
    });

    this.logger.log(
      `Prepared metadata ${metadataCid} for item ${id} (request ${requestId})`,
    );
    return {
      contentId: id,
      tokenUri: `ipfs://${metadataCid}`,
      metadataCid,
      imageCid,
      masterHash,
      title,
      category,
    };
  }

  private async readItem(id: string, requestId: string): Promise<ItemSnapshot> {
    const result = await this.content.getItem(id, requestId);
    switch (result.kind) {
      case 'found':
        // Unpublished between the lookup and this read.
        if (result.item.publicationStatus !== 'published') {
          throw contentNotPublished(requestId);
        }
        return result.item;
      case 'not_found':
        // A guest gets 404 for an item that is no longer published.
        throw contentNotPublished(requestId);
      case 'content_unavailable':
        throw contentUnavailable(requestId);
    }
  }

  private async readMaster(
    id: string,
    master: SnapshotMedia,
    requestId: string,
  ): Promise<MasterFile> {
    const opened = await this.content.openMedia(id, master.id, requestId);
    if (opened.kind === 'not_found') throw contentNotPublished(requestId);
    if (opened.kind === 'content_unavailable') {
      throw contentUnavailable(requestId);
    }
    const { media } = opened;
    const keep = master.kind === 'image';
    const limits = this.config.limits;
    const limit = keep ? limits.imageBytes : limits.masterBytes;

    const hash = createHash('sha256');
    const chunks: Buffer[] = [];
    let total = 0;
    try {
      for await (const chunk of media.body) {
        total += chunk.byteLength;
        if (total > limit) {
          await media.cancel();
          throw mediaTooLarge(requestId);
        }
        hash.update(chunk);
        if (keep) chunks.push(Buffer.from(chunk));
      }
    } catch (error) {
      if (error instanceof PublicError) throw error;
      this.logger.warn(
        `Media ${master.id} download interrupted (request ${requestId})`,
      );
      throw contentUnavailable(requestId);
    }

    const sha256 = hash.digest('hex');
    if (media.recordedSha256 !== sha256 || total !== master.bytes) {
      this.logger.error(
        `Media ${master.id} of item ${id} fails its integrity check: ` +
          `recorded ${media.recordedSha256 ?? 'none'}, computed ${sha256}, ` +
          `${String(total)} of ${String(master.bytes)} bytes (request ${requestId})`,
      );
      throw mediaIntegrityFailed(requestId);
    }
    return { sha256, bytes: keep ? Buffer.concat(chunks) : null };
  }

  private async pin(
    requestId: string,
    request: Parameters<Pinner['pin']>[0],
  ): Promise<string> {
    try {
      return (await this.pinner.pin(request, requestId)).cid;
    } catch (error) {
      if (error instanceof IpfsError) throw ipfsUnavailable(requestId);
      throw error;
    }
  }
}
