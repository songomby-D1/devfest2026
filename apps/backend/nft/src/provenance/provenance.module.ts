import { Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { ContentModule } from '../content/content.module';
import { ProvenanceController } from './provenance.controller';
import {
  InMemoryMintRecordReader,
  UnconfiguredChainProvenanceReader,
} from './provenance.fakes';
import { CHAIN_PROVENANCE_READER, MINT_RECORD_READER } from './provenance.ports';
import {
  PROVENANCE_OPTIONS,
  type ProvenanceOptions,
  ProvenanceService,
} from './provenance.service';

/** The on-chain verification gives up after this long. */
export const CHAIN_READ_TIMEOUT_MS = 3_000;

/**
 * NFT-05: provenance display data. The two read ports are bound to FAKES
 * until the wiring follow-up binds NFT-04's `MintRepository` and viem
 * client (docs/provenance.md): with them, every item reads as `mint: null`.
 */
@Module({
  imports: [ContentModule],
  controllers: [ProvenanceController],
  providers: [
    ProvenanceService,
    // FAKE default bindings, replaced by the wiring follow-up.
    { provide: MINT_RECORD_READER, useValue: new InMemoryMintRecordReader() },
    {
      provide: CHAIN_PROVENANCE_READER,
      useValue: new UnconfiguredChainProvenanceReader(),
    },
    {
      provide: PROVENANCE_OPTIONS,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): ProvenanceOptions => ({
        explorerBaseUrl: config.chain.explorerBaseUrl,
        ipfsGatewayUrl: config.ipfs.gatewayUrl,
        chainTimeoutMs: CHAIN_READ_TIMEOUT_MS,
      }),
    },
  ],
  exports: [ProvenanceService],
})
export class ProvenanceModule {}
