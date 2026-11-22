import { Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { ContentClient } from './content-client';
import { ContentReferenceService } from './content-reference.service';

/** NFT → Content integration (NFT-02). The mint flow (NFT-04) imports it. */
@Module({
  providers: [
    {
      provide: ContentClient,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): ContentClient =>
        new ContentClient({
          baseUrl: config.content.serviceUrl,
          token: config.contentServiceToken,
          timeoutMs: config.content.timeoutMs,
        }),
    },
    ContentReferenceService,
  ],
  exports: [ContentReferenceService],
})
export class ContentModule {}
