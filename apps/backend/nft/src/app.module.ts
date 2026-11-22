import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { ContentModule } from './content/content.module';
import { HealthController } from './http/health.controller';
import { MetadataModule } from './metadata/metadata.module';
import { ProvenanceModule } from './provenance/provenance.module';

@Module({
  imports: [AppConfigModule, ContentModule, MetadataModule, ProvenanceModule],
  controllers: [HealthController],
})
export class AppModule {}
