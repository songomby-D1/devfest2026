import { Module } from '@nestjs/common';
import { MediaController } from '../media/media.controller';
import { MediaService } from '../media/media.service';
import { StorageModule } from '../storage/storage.module';
import { ITEM_REPOSITORY } from './item-repository';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';
import { PrismaItemRepository } from './prisma-item-repository';

@Module({
  imports: [StorageModule],
  controllers: [ItemsController, MediaController],
  providers: [
    ItemsService,
    MediaService,
    { provide: ITEM_REPOSITORY, useClass: PrismaItemRepository },
  ],
})
export class ItemsModule {}
