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
  Query,
  UseGuards,
} from '@nestjs/common';
import { Caller, type CallerContext } from '../common/caller-context';
import { CallingService } from '../common/calling-service';
import { PublicError } from '../common/public-error';
import { ServiceTokenGuard } from '../common/service-token.guard';
import { parseOrThrow } from '../common/zod-validation';
import type { ServiceCaller } from '../config/app-config';
import { listItemsQuerySchema } from './item-list';
import {
  createItemSchema,
  decisionSchema,
  reviewSchema,
  unpublishSchema,
  updateItemSchema,
} from './item-schemas';
import type {
  ItemDetailView,
  ItemPageView,
  PublicationLookupView,
} from './item-view';
import { ItemsService } from './items.service';

const itemId = new ParseUUIDPipe({
  exceptionFactory: () =>
    PublicError.validation([{ field: 'id', reason: 'must be a UUID' }]),
});

/**
 * Internal routes behind the gateway (`/api/items...` forwards to
 * `/internal/v1/items...`), plus the publication lookup for NFT and LiDAR.
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

  @Get()
  list(
    @Caller() caller: CallerContext,
    @Query() query: unknown,
  ): Promise<ItemPageView> {
    return this.items.list(caller, parseOrThrow(listItemsQuerySchema, query));
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

  @Post(':id/review')
  @HttpCode(HttpStatus.CREATED)
  review(
    @Caller() caller: CallerContext,
    @Param('id', itemId) id: string,
    @Body() body: unknown,
  ): Promise<ItemDetailView> {
    return this.items.review(caller, id, parseOrThrow(reviewSchema, body));
  }

  @Post(':id/decision')
  @HttpCode(HttpStatus.OK)
  decide(
    @Caller() caller: CallerContext,
    @Param('id', itemId) id: string,
    @Body() body: unknown,
  ): Promise<ItemDetailView> {
    return this.items.decide(caller, id, parseOrThrow(decisionSchema, body));
  }

  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  unpublish(
    @Caller() caller: CallerContext,
    @Param('id', itemId) id: string,
    @Body() body: unknown,
  ): Promise<ItemDetailView> {
    return this.items.unpublish(
      caller,
      id,
      parseOrThrow(unpublishSchema, body),
    );
  }

  @Get(':id/publication')
  publication(
    @CallingService() service: ServiceCaller,
    @Param('id', itemId) id: string,
  ): Promise<PublicationLookupView> {
    return this.items.publication(service, id);
  }
}
