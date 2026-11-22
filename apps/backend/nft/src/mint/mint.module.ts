import { Module } from '@nestjs/common';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { ServiceTokenGuard } from '../common/service-token.guard';
import { ContentModule } from '../content/content.module';
import { METADATA_PUBLISHER } from '../metadata/metadata-publisher.port';
import { FakeMetadataPublisher } from './fake-metadata-publisher';
import { MintController } from './mint.controller';
import { MintProcessor } from './mint-processor';
import { MINT_REPOSITORY } from './mint-repository';
import { MintService } from './mint.service';
import { PrismaMintRepository } from './prisma-mint-repository';

/**
 * The owner's mint journey and its background worker (NFT-04).
 *
 * `METADATA_PUBLISHER` is the placeholder `FakeMetadataPublisher` until the
 * NFT-03 publisher (#61) is wired in by a follow-up: that change replaces
 * this provider and nothing else.
 */
@Module({
  imports: [ContentModule, BlockchainModule],
  controllers: [MintController],
  providers: [
    MintService,
    MintProcessor,
    ServiceTokenGuard,
    { provide: MINT_REPOSITORY, useClass: PrismaMintRepository },
    { provide: METADATA_PUBLISHER, useClass: FakeMetadataPublisher },
  ],
})
export class MintModule {}
