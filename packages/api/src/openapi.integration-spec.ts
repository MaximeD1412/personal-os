import type { INestApplication } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './app/app.module';
import { documentOpenApi, exposerOpenApi } from './openapi';

async function monter(
  env: Record<string, string | undefined>,
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  exposerOpenApi(app, env);
  await app.init();
  return app;
}

/** Les schémas qu'une opération désigne, par leur nom de composant. */
function references(operation: unknown): string[] {
  return [
    ...JSON.stringify(operation).matchAll(/#\/components\/schemas\/(\w+)/g),
  ].map(([, nom]) => nom);
}

describe("L'OpenAPI, déduit des schémas (ADR 0030)", () => {
  describe('Le document', () => {
    let app: INestApplication;
    let document: OpenAPIObject;

    beforeAll(async () => {
      app = await monter({});
      document = documentOpenApi(app);
    });

    afterAll(async () => {
      await app?.close();
    });

    it("décrit chaque route des Événements et de l'Agenda", () => {
      expect(Object.keys(document.paths['/api/events'] ?? {})).toEqual(
        expect.arrayContaining(['get', 'post']),
      );
      expect(Object.keys(document.paths['/api/events/{id}'] ?? {})).toEqual(
        expect.arrayContaining(['patch', 'delete']),
      );
      expect(Object.keys(document.paths['/api/agenda'] ?? {})).toEqual(['get']);
    });

    it('exige la période des lectures, en paramètres de requête', () => {
      for (const chemin of ['/api/events', '/api/agenda']) {
        const parametres = document.paths[chemin].get?.parameters ?? [];

        expect(parametres).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              name: 'from',
              in: 'query',
              required: true,
            }),
            expect.objectContaining({
              name: 'to',
              in: 'query',
              required: true,
            }),
          ]),
        );
      }
    });

    it('déclare le statut de chaque réponse', () => {
      const statuts = (
        chemin: string,
        verbe: 'get' | 'post' | 'patch' | 'delete',
      ) => Object.keys(document.paths[chemin][verbe]?.responses ?? {});

      expect(statuts('/api/events', 'get')).toEqual(['200']);
      expect(statuts('/api/events', 'post')).toEqual(['201']);
      expect(statuts('/api/events/{id}', 'patch')).toEqual(['200']);
      expect(statuts('/api/events/{id}', 'delete')).toEqual(['204']);
      expect(statuts('/api/agenda', 'get')).toEqual(['200']);
    });

    it("porte le schéma d'entrée et de sortie de chaque route", () => {
      const evenements = document.paths['/api/events'];
      const unEvenement = document.paths['/api/events/{id}'];

      expect(references(evenements.get?.responses)).toContain(
        'EventDto_Output',
      );
      expect(references(evenements.post?.requestBody)).toEqual([
        'EventInputDto',
      ]);
      expect(references(evenements.post?.responses)).toContain(
        'EventDto_Output',
      );
      expect(references(unEvenement.patch?.requestBody)).toEqual([
        'EventUpdateDto',
      ]);
      expect(references(unEvenement.patch?.responses)).toContain(
        'EventDto_Output',
      );
      expect(
        references(document.paths['/api/agenda'].get?.responses),
      ).toContain('AgendaItemDto_Output');
    });

    it('décrit les champs des schémas, et non des objets vides', () => {
      const schemas = document.components?.schemas ?? {};

      expect(schemas['EventInputDto']).toMatchObject({
        required: expect.arrayContaining([
          'title',
          'startsAt',
          'category',
          'scopeId',
        ]),
        properties: {
          category: { enum: ['APPOINTMENT', 'BIRTHDAY', 'DEADLINE', 'OTHER'] },
        },
      });
      expect(Object.keys(schemas['AgendaItemDto_Output'] ?? {})).toContain(
        'properties',
      );
    });
  });

  describe('Le document servi', () => {
    let app: INestApplication | undefined;

    afterEach(async () => {
      await app?.close();
      app = undefined;
    });

    it('est servi en /api/openapi.json hors production, sans session', async () => {
      app = await monter({ APP_ENV: 'staging' });

      const reponse = await request(app.getHttpServer())
        .get('/api/openapi.json')
        .expect(200);

      expect(Object.keys((reponse.body as OpenAPIObject).paths)).toContain(
        '/api/events',
      );
    });

    it("n'est pas servi en production", async () => {
      app = await monter({ APP_ENV: 'production' });

      await request(app.getHttpServer()).get('/api/openapi.json').expect(404);
    });
  });
});
