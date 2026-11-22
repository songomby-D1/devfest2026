import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Caller, type CallerContext } from '../common/caller-context';
import { PublicError } from '../common/public-error';
import { ServiceTokenGuard } from '../common/service-token.guard';
import { parseOrThrow } from '../common/zod-validation';
import { createItemSchema, updateItemSchema } from './item-schemas';
import type { ItemDetailView } from './item-view';
import { ItemsService } from './items.service';

const itemId = new ParseUUIDPipe({
  exceptionFactory: () =>
    PublicError.validation([{ field: 'id', reason: 'must be a UUID' }]),
});

/**
 * Internal routes behind the gateway (`/api/items...` forwards to
 * `/internal/v1/items...`). Listing and publication arrive with CONTENT-02.
 */
@Controller('internal/v1/items')
@UseGuards(ServiceTokenGuard)
export class ItemsController {
  constructor(@Inject(ItemsService) private readonly items: ItemsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Caller() caller: CallerContext,
    @Body() body: unknown,
  ): Promise<ItemDetailView> {
    return this.items.create(caller, parseOrThrow(createItemSchema, body));
  }

  @Get(':id')
  get(
    @Caller() caller: CallerContext,
    @Param('id', itemId) id: string,
  ): Promise<ItemDetailView> {
    return this.items.get(caller, id);
  }

  @Patch(':id')
  update(
    @Caller() caller: CallerContext,
    @Param('id', itemId) id: string,
    @Body() body: unknown,
  ): Promise<ItemDetailView> {
    return this.items.update(caller, id, parseOrThrow(updateItemSchema, body));
  }
}
