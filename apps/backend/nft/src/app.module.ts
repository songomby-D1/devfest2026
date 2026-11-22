import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { ContentModule } from './content/content.module';
import { HealthController } from './http/health.controller';
import { MetadataModule } from './metadata/metadata.module';
import { MintModule } from './mint/mint.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    AppConfigModule,
    ContentModule,
    MetadataModule,
    PrismaModule,
    MintModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
