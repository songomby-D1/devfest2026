import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AppConfigService } from '../../src/config/app-config.service';

describe('nft-service HTTP (e2e)', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<INestApplication<Server>>();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health responds 200 with status ok', async () => {
    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('loads the validated configuration with converted types', () => {
    const config = app.get(AppConfigService);

    expect(config.http.port).toBe(3005);
    expect(config.chain.chainId).toBe(43113);
    expect(config.ipfs.driver).toBe('fake');
  });
});
