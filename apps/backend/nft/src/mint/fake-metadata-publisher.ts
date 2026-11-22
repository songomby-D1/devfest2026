import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import type {
  MetadataContext,
  MetadataPublisher,
  PreparedMetadata,
} from '../metadata/metadata-publisher.port';

/**
 * Stand-in `MetadataPublisher` until NFT-03 (#61) is wired in: the mint
 * module provides it for `METADATA_PUBLISHER`, and the follow-up after both
 * PRs merge replaces that provider with the real IPFS publisher.
 *
 * It pins nothing and reads nothing from Content: every value is derived
 * from the ContentId, so it is deterministic and public. It refuses to run
 * in production, so a production mint fails with `METADATA_UNAVAILABLE`
 * instead of writing placeholder metadata on-chain.
 */
@Injectable()
export class FakeMetadataPublisher implements MetadataPublisher {
  private readonly logger = new Logger(FakeMetadataPublisher.name);

  constructor(private readonly config: AppConfigService) {}

  prepare(
    contentId: string,
    context: MetadataContext,
  ): Promise<PreparedMetadata> {
    if (this.config.nodeEnv === 'production') {
      return Promise.reject(
        new Error('FakeMetadataPublisher is disabled in production'),
      );
    }
    const id = contentId.toLowerCase();
    const digest = (label: string): string =>
      createHash('sha256').update(`${label}:${id}`).digest('hex');
    const metadataCid = `fake-${digest('metadata').slice(0, 46)}`;
    this.logger.warn(
      `Placeholder metadata used for ${id} (request ${context.requestId})`,
    );
    return Promise.resolve({
      contentId: id,
      tokenUri: `ipfs://${metadataCid}`,
      metadataCid,
      imageCid: null,
      masterHash: `0x${digest('master')}`,
      title: `LOVA item ${id.slice(0, 8)}`,
      category: 'Painting',
    });
  }
}
