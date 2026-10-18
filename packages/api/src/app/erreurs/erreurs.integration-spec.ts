import {
  Body,
  Controller,
  Get,
  type INestApplication,
  Logger,
  Module,
  Post,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type ApiError, zApiError } from '@personal-os/contracts';
import { createZodDto } from 'nestjs-zod';
import request from 'supertest';
import { z } from 'zod';
import { AppModule } from '../app.module';
import { Public } from '../auth/public.decorator';
import { ErreurMetier } from './erreur-metier';

const MESSAGE_INTERNE = 'connexion refusée par 10.0.0.12:5432';

class SaisieImbriquee extends createZodDto(
  z.object({ a: z.object({ b: z.array(z.object({ c: z.int() })) }) }),
) {}

/**
 * Des routes qui n'existent que dans ce test : on y vérifie le **mécanisme**,
 * le filtre global posé dans `AppModule`, et non un module en particulier.
 */
@Public()
@Controller('erreurs-de-test')
class ControleurDErreurs {
  @Post('saisie')
  recevoir(@Body() saisie: SaisieImbriquee): SaisieImbriquee {
    return saisie;
  }

  @Get('regle')
  regle(): never {
    throw new ErreurMetier('test.rule_broken', 'La règle est violée.');
  }

  @Get('panne')
  panne(): never {
    throw new Error(MESSAGE_INTERNE);
  }
}

@Module({ controllers: [ControleurDErreurs] })
class ModuleDErreurs {}

describe("L'enveloppe d'erreur unique (ADR 0030)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, ModuleDErreurs],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('rend une erreur métier en 422 avec son code', async () => {
    const reponse = await request(app.getHttpServer())
      .get('/api/erreurs-de-test/regle')
      .expect(422);

    expect(enveloppe(reponse.body)).toEqual({
      status: 422,
      code: 'test.rule_broken',
      message: 'La règle est violée.',
    });
  });

  it('pointe un champ imbriqué par un chemin à points', async () => {
    const reponse = await request(app.getHttpServer())
      .post('/api/erreurs-de-test/saisie')
      .send({ a: { b: [{ c: 'x' }] } })
      .expect(400);

    const corps = enveloppe(reponse.body);
    expect(corps.code).toBe('request.invalid');
    expect(corps.fields?.[0].path).toBe('a.b.0.c');
  });

  it('rend une panne en 500 sans pile ni message interne', async () => {
    const journal = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    const reponse = await request(app.getHttpServer())
      .get('/api/erreurs-de-test/panne')
      .expect(500);

    expect(enveloppe(reponse.body)).toMatchObject({
      status: 500,
      code: 'internal',
    });
    expect(reponse.text).not.toContain(MESSAGE_INTERNE);
    expect(reponse.text).not.toContain('erreurs.integration-spec');
    journal.mockRestore();
  });

  it('rend une route inconnue dans la même enveloppe', async () => {
    const reponse = await request(app.getHttpServer())
      .get('/api/erreurs-de-test/inconnue')
      .expect(404);

    expect(enveloppe(reponse.body).code).toBe('http.404');
  });
});

function enveloppe(corps: unknown): ApiError {
  return zApiError.strict().parse(corps);
}
