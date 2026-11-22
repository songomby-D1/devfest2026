import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpException,
  Param,
  Post,
  ServiceUnavailableException,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  AssetAlreadyRegisteredError,
  type AssetDisplay,
  ContentNotPublishedError,
  type RegisteredAsset,
} from './asset.js';
import { AdminTokenGuard } from './admin-token.guard.js';
import { AssetsService } from './assets.service.js';
import { ContentDirectoryUnavailableError } from './content-directory.js';
import {
  contentIdSchema,
  type RegisterAssetDto,
  registerAssetSchema,
} from './register-asset.dto.js';

@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get('by-content/:contentId')
  findByContent(
    @Param('contentId', new ZodValidationPipe(contentIdSchema))
    contentId: string,
  ): Promise<AssetDisplay> {
    return this.assetsService.findDisplayByContentId(contentId);
  }

  @Post()
  @UseGuards(AdminTokenGuard)
  async register(
    @Body(new ZodValidationPipe(registerAssetSchema)) body: RegisterAssetDto,
  ): Promise<RegisteredAsset> {
    try {
      return await this.assetsService.register(body);
    } catch (error) {
      throw toHttpException(error) ?? error;
    }
  }
}

function toHttpException(error: unknown): HttpException | undefined {
  if (error instanceof ContentNotPublishedError)
    return new UnprocessableEntityException(error.message);
  if (error instanceof AssetAlreadyRegisteredError)
    return new ConflictException(error.message);
  if (error instanceof ContentDirectoryUnavailableError) {
    return new ServiceUnavailableException('Content service unavailable');
  }
  return undefined;
}
