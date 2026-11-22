import { Logger, Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { InMemoryPinner } from './in-memory-pinner';
import { PinataPinner } from './pinata-pinner';
import { PINNER, type Pinner } from './pinner';

/** IPFS pinning (NFT-03, S21): Pinata, or in memory with `IPFS_DRIVER=fake`. */
@Module({
  providers: [
    {
      provide: PINNER,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): Pinner => {
        if (config.ipfs.driver === 'fake') {
          new Logger('IpfsModule').warn(
            'IPFS_DRIVER=fake: pins stay in memory and nothing is published',
          );
          return new InMemoryPinner();
        }
        return new PinataPinner({
          jwt: config.pinataJwt,
          timeoutMs: config.ipfs.timeoutMs,
        });
      },
    },
  ],
  exports: [PINNER],
})
export class IpfsModule {}
