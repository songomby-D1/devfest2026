import { Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { BLOCKCHAIN_PORT, type BlockchainPort } from './blockchain.port';
import { ViemBlockchain } from './viem-blockchain';

/** The chain adapter (lot L5). Tests replace `BLOCKCHAIN_PORT` with a fake. */
@Module({
  providers: [
    {
      provide: BLOCKCHAIN_PORT,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): BlockchainPort =>
        new ViemBlockchain({
          rpcUrl: config.chain.rpcUrl,
          chainId: config.chain.chainId,
          contractAddress: config.chain.contractAddress,
          privateKey: config.minterPrivateKey,
        }),
    },
  ],
  exports: [BLOCKCHAIN_PORT],
})
export class BlockchainModule {}
