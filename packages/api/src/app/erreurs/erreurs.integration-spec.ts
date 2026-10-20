import {
  Body,
  Controller,
  Get,
  Logger,
  Module,
  NotFoundException,
  Post,
} from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { type ApiError, zApiError } from '@personal-os/contracts';
import { createZodDto } from 'nestjs-zod';
import request from 'supertest';
import { z } from 'zod';
import { accepterLesCorpsJson } from '../../corps';
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

  @Get('absent')
  absent(): never {
    throw new NotFoundException('Aucun objet de test.');
  }

  @Get('panne')
  panne(): never {
    throw new Error(MESSAGE_INTERNE);
  }
}

@Module({ controllers: [ControleurDErreurs] })
class ModuleDErreurs {}

describe("L'enveloppe d'erreur unique (ADR 0030)", () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, ModuleDErreurs],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.setGlobalPrefix('api');
    accepterLesCorpsJson(app);
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

  it('garde le message explicite d’une exception levée par une route', async () => {
    const reponse = await request(app.getHttpServer())
      .get('/api/erreurs-de-test/absent')
      .expect(404);

    expect(enveloppe(reponse.body).message).toBe('Aucun objet de test.');
  });

  it('rend une route inconnue dans la même enveloppe, en français', async () => {
    const reponse = await request(app.getHttpServer())
      .get('/api/erreurs-de-test/inconnue')
      .expect(404);

    expect(enveloppe(reponse.body)).toEqual({
      status: 404,
      code: 'http.404',
      message: 'Aucune ressource à cette adresse.',
    });
  });

  it('garde le 413 du parseur pour un body trop volumineux', async () => {
    const journal = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    const reponse = await request(app.getHttpServer())
      .post('/api/erreurs-de-test/saisie')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ a: { b: [] }, remplissage: 'x'.repeat(2_200_000) }))
      .expect(413);

    expect(enveloppe(reponse.body)).toEqual({
      status: 413,
      code: 'http.413',
      message: 'La requête est trop volumineuse.',
    });
    expect(journal).not.toHaveBeenCalled();
    journal.mockRestore();
  });

  it('refuse en 400 un JSON illisible, avec un message français', async () => {
    const reponse = await request(app.getHttpServer())
      .post('/api/erreurs-de-test/saisie')
      .set('Content-Type', 'application/json')
      .send('{"a": ')
      .expect(400);

    expect(enveloppe(reponse.body)).toEqual({
      status: 400,
      code: 'http.400',
      message: 'La requête est mal formée.',
    });
  });
});

function enveloppe(corps: unknown): ApiError {
  return zApiError.strict().parse(corps);
}
