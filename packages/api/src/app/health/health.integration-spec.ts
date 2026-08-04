import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { HealthResponse } from '@personal-os/contracts';
import { PrismaService } from '@personal-os/database';
import request from 'supertest';
import { AppModule } from '../app.module';

describe('GET /api/health', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    await prisma.healthProbe.deleteMany();
  });

  it('rend la sonde effectivement enregistrée en base', async () => {
    await prisma.healthProbe.create({
      data: {
        label: 'Personal OS',
        recordedAt: new Date('2026-08-04T08:30:00.000Z'),
      },
    });

    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(response.body as HealthResponse).toEqual({
      status: 'ok',
      database: {
        label: 'Personal OS',
        recordedAt: '2026-08-04T08:30:00.000Z',
      },
    });
  });

  it('répond 503 tant que la base ne porte aucune sonde', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(503);
  });
});
