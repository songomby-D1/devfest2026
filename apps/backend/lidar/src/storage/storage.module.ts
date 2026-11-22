import { S3Client } from '@aws-sdk/client-s3';
import { Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { OBJECT_STORAGE } from './object-storage.js';
import { S3ObjectStorage } from './s3-object-storage.js';

@Module({
  providers: [
    {
      provide: OBJECT_STORAGE,
      inject: [APP_CONFIG],
      useFactory: ({ storage }: AppConfig) =>
        new S3ObjectStorage({
          client: new S3Client({
            endpoint: storage.endpoint,
            region: storage.region,
            forcePathStyle: storage.forcePathStyle,
            // S3-compatible stores such as SeaweedFS may not accept the SDK's default
            // streaming checksums; only send them when the operation requires one.
            requestChecksumCalculation: 'WHEN_REQUIRED',
            responseChecksumValidation: 'WHEN_REQUIRED',
            credentials: {
              accessKeyId: storage.credentials.accessKeyId,
              secretAccessKey: storage.credentials.secretAccessKey,
            },
          }),
          bucket: storage.bucket,
          prefix: storage.prefix,
        }),
    },
  ],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
