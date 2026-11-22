import { Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { ContentModule } from '../content/content.module';
import { IpfsModule } from '../ipfs/ipfs.module';
import { ContentSnapshotClient } from './content-snapshot-client';
import { METADATA_PUBLISHER } from './metadata-publisher.port';
import { MetadataService } from './metadata.service';

/** A media download may take this long before it is abandoned. */
export const MEDIA_DOWNLOAD_TIMEOUT_MS = 120_000;

/**
 * NFT-03: prepares and pins the public metadata of a published item. The
 * mint flow (NFT-04) injects `METADATA_PUBLISHER`.
 */
@Module({
  imports: [ContentModule, IpfsModule],
  providers: [
    {
      provide: ContentSnapshotClient,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): ContentSnapshotClient =>
        new ContentSnapshotClient({
          baseUrl: config.content.serviceUrl,
          token: config.contentServiceToken,
          timeoutMs: config.content.timeoutMs,
          mediaTimeoutMs: MEDIA_DOWNLOAD_TIMEOUT_MS,
        }),
    },
    MetadataService,
    { provide: METADATA_PUBLISHER, useExisting: MetadataService },
  ],
  exports: [METADATA_PUBLISHER],
})
export class MetadataModule {}
