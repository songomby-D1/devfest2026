import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { ContentModule } from './content/content.module';
import { HealthController } from './http/health.controller';
import { MintModule } from './mint/mint.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [AppConfigModule, ContentModule, PrismaModule, MintModule],
  controllers: [HealthController],
})
export class AppModule {}
