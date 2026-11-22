import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { ContentModule } from './content/content.module';
import { HealthController } from './http/health.controller';

@Module({
  imports: [AppConfigModule, ContentModule],
  controllers: [HealthController],
})
export class AppModule {}
