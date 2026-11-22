import { Module } from '@nestjs/common';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { ServiceTokenGuard } from '../common/service-token.guard';
import { ContentModule } from '../content/content.module';
import { MetadataModule } from '../metadata/metadata.module';
import { ProvenanceService } from '../provenance/provenance.service';
import { MintController } from './mint.controller';
import { MintProcessor } from './mint-processor';
import { MINT_REPOSITORY } from './mint-repository';
import { MintService } from './mint.service';
import { PrismaMintRepository } from './prisma-mint-repository';

/**
 * The owner's mint journey and its background worker (NFT-04), and the
 * provenance display (NFT-05). `METADATA_PUBLISHER` is NFT-03's
 * `MetadataService`, exported by `MetadataModule`.
 */
@Module({
  imports: [ContentModule, BlockchainModule, MetadataModule],
  controllers: [MintController],
  providers: [
    MintService,
    ProvenanceService,
    MintProcessor,
    ServiceTokenGuard,
    { provide: MINT_REPOSITORY, useClass: PrismaMintRepository },
  ],
})
export class MintModule {}
