import {
  Body,
  Controller,
  type INestApplication,
  Module,
  Post,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { zDay, zWeek } from '@personal-os/contracts';
import { createZodDto } from 'nestjs-zod';
import request from 'supertest';
import { z } from 'zod';
import { AppModule } from './app.module';
import { Public } from './auth/public.decorator';

class SaisieDeSemaine extends createZodDto(
  z.object({ week: zWeek, note: zDay.optional() }),
) {}

/**
 * Une route qui n'existe que dans ce test : on y vérifie le **mécanisme**, le
 * pipe global posé dans `AppModule`, et non un module en particulier.
 */
@Controller('validation-de-test')
class ControleurDeValidation {
  @Public()
  @Post()
  recevoir(@Body() saisie: SaisieDeSemaine): SaisieDeSemaine {
    return saisie;
  }
}

@Module({ controllers: [ControleurDeValidation] })
class ModuleDeValidation {}

describe('Le pipe de validation global (ADR 0030)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, ModuleDeValidation],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('laisse passer un body conforme au schéma', async () => {
    const reponse = await request(app.getHttpServer())
      .post('/api/validation-de-test')
      .send({ week: '2026-10-19' })
      .expect(201);

    expect(reponse.body).toEqual({ week: '2026-10-19' });
  });

  it('refuse en 400 un body qui ne respecte pas le schéma', async () => {
    await request(app.getHttpServer())
      .post('/api/validation-de-test')
      .send({ week: '2026-10-20' })
      .expect(400);
  });

  it('refuse en 400 un body sans le champ requis', async () => {
    await request(app.getHttpServer())
      .post('/api/validation-de-test')
      .send({ note: '2026-10-20' })
      .expect(400);
  });
});
