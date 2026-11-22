import { Module } from '@nestjs/common';
import { ITEM_REPOSITORY } from './item-repository';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';
import { PrismaItemRepository } from './prisma-item-repository';

@Module({
  controllers: [ItemsController],
  providers: [
    ItemsService,
    { provide: ITEM_REPOSITORY, useClass: PrismaItemRepository },
  ],
})
export class ItemsModule {}
