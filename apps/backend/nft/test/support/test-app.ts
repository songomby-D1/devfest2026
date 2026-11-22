import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { BLOCKCHAIN_PORT } from '../../src/blockchain/blockchain.port';
import type { AppConfigService } from '../../src/config/app-config.service';
import { ContentClient } from '../../src/content/content-client';
import { METADATA_PUBLISHER } from '../../src/metadata/metadata-publisher.port';
import {
  MINT_REPOSITORY,
  type MintRepository,
} from '../../src/mint/mint-repository';
import { MintProcessor } from '../../src/mint/mint-processor';
import { PrismaService } from '../../src/prisma/prisma.service';
import { FakeBlockchain } from './fake-blockchain';
import { FakeMetadataPublisher } from './fake-metadata-publisher';
import { CONTENT_TOKEN } from './fake-content';

export const GATEWAY_TOKEN = 'gateway-to-nft-test';
export const OWNER_ID = '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f';
export const OTHER_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

export interface TestApp {
  readonly app: INestApplication<Server>;
  readonly chain: FakeBlockchain;
  readonly processor: MintProcessor;
}

/**
 * Boots the real application with a fake chain and a fake Content. With a
 * repository the database is replaced by it; with `databaseUrl` the Prisma
 * repository talks to that database.
 */
export async function createTestApp(options: {
  contentUrl: string;
  repository?: MintRepository;
  chain?: FakeBlockchain;
  /** A database URL for the Prisma repository (integration tests). */
  databaseUrl?: string;
}): Promise<TestApp> {
  const chain = options.chain ?? new FakeBlockchain();
  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(BLOCKCHAIN_PORT)
    .useValue(chain)
    .overrideProvider(METADATA_PUBLISHER)
    .useClass(FakeMetadataPublisher)
    .overrideProvider(ContentClient)
    .useValue(
      new ContentClient({
        baseUrl: options.contentUrl,
        token: CONTENT_TOKEN,
        timeoutMs: 1000,
        retries: 0,
      }),
    );
  if (options.databaseUrl !== undefined) {
    // The environment is read when AppModule is imported, before the
    // container starts: build the client with the container URL instead.
    builder = builder.overrideProvider(PrismaService).useValue(
      new PrismaService({
        databaseUrl: options.databaseUrl,
      } as AppConfigService),
    );
  }
  if (options.repository !== undefined) {
    builder = builder
      .overrideProvider(MINT_REPOSITORY)
      .useValue(options.repository)
      .overrideProvider(PrismaService)
      .useValue({ $disconnect: () => Promise.resolve() });
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<INestApplication<Server>>({
    logger: false,
  });
  await app.init();
  return { app, chain, processor: app.get(MintProcessor) };
}

/** Headers the gateway sends for a caller (platform contract). */
export function gatewayHeaders(
  userId: string | null,
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    'x-service-name': 'gateway',
    'x-service-token': GATEWAY_TOKEN,
    'x-caller-permissions': '',
    'x-request-id': 'req-mint-1',
    ...(userId === null ? {} : { 'x-caller-user-id': userId }),
    ...extra,
  };
}
