import type { OpenAPIObject } from '@nestjs/swagger';
import type { CommandAnnotation } from '@personal-os/contracts';
import { CatalogueIncoherent, genererCatalogue } from './generer';

const CREER_UN_EVENEMENT: CommandAnnotation = {
  intent: 'Créer un Événement',
  examples: ['ajoute un rendez-vous chez le dentiste jeudi à 10 h'],
  screen: '/calendrier/evenements/nouveau',
  params: { title: 'required', startsAt: 'optional' },
};

/** Un OpenAPI réduit à ce que le générateur lit, sur le modèle de celui de l'API. */
function openapi(
  paths: Record<string, Record<string, object>>,
  schemas: Record<string, object> = {},
): OpenAPIObject {
  return {
    openapi: '3.1.0',
    info: { title: 'Personal OS', version: '1' },
    // Les types de `@nestjs/swagger` ne connaissent pas les extensions `x-`.
    paths: paths as OpenAPIObject['paths'],
    components: { schemas },
  };
}

const SCHEMAS = {
  EventInputDto: {
    type: 'object',
    properties: {
      title: { type: 'string', minLength: 1 },
      startsAt: { type: 'string', format: 'date-time' },
      scopeId: { type: 'string', minLength: 1 },
    },
    required: ['title', 'startsAt', 'scopeId'],
  },
};

const CORPS = {
  required: true,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/EventInputDto' },
    },
  },
};

describe("La génération du catalogue d'actions (ADR 0018)", () => {
  it('fait une action de chaque opération annotée, avec le schéma de ses champs', () => {
    const catalogue = genererCatalogue(
      openapi(
        {
          '/api/events': {
            post: {
              operationId: 'EventController_creer',
              requestBody: CORPS,
              responses: {},
              'x-command': CREER_UN_EVENEMENT,
            },
          },
        },
        SCHEMAS,
      ),
    );

    expect(catalogue).toEqual({
      actions: [
        {
          id: 'EventController_creer',
          intent: 'Créer un Événement',
          examples: ['ajoute un rendez-vous chez le dentiste jeudi à 10 h'],
          screen: '/calendrier/evenements/nouveau',
          params: {
            title: {
              required: true,
              schema: { type: 'string', minLength: 1 },
            },
            startsAt: {
              required: false,
              schema: { type: 'string', format: 'date-time' },
            },
          },
        },
      ],
    });
  });

  it("ignore une opération sans annotation : elle n'existe pas pour la barre", () => {
    const catalogue = genererCatalogue(
      openapi(
        {
          '/api/events': {
            get: { operationId: 'EventController_lister', responses: {} },
            post: {
              operationId: 'EventController_creer',
              requestBody: CORPS,
              responses: {},
            },
          },
        },
        SCHEMAS,
      ),
    );

    expect(catalogue).toEqual({ actions: [] });
  });

  it('prend aussi les paramètres de requête et de chemin pour champs', () => {
    const catalogue = genererCatalogue(
      openapi({
        '/api/events/{id}': {
          get: {
            operationId: 'EventController_lire',
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string' },
              },
              {
                name: 'from',
                in: 'query',
                required: true,
                schema: { type: 'string', format: 'date-time' },
              },
            ],
            responses: {},
            'x-command': {
              intent: 'Ouvrir un Événement',
              examples: ['montre-moi le dentiste'],
              screen: '/calendrier/evenements',
              params: { id: 'required', from: 'optional' },
            },
          },
        },
      }),
    );

    expect(catalogue.actions[0].params).toEqual({
      id: { required: true, schema: { type: 'string' } },
      from: {
        required: false,
        schema: { type: 'string', format: 'date-time' },
      },
    });
  });

  it("recopie dans l'action les schémas qu'un champ désigne par référence", () => {
    const catalogue = genererCatalogue(
      openapi(
        {
          '/api/events': {
            post: {
              operationId: 'EventController_creer',
              requestBody: CORPS,
              responses: {},
              'x-command': {
                ...CREER_UN_EVENEMENT,
                params: { recurrence: 'optional' },
              },
            },
          },
        },
        {
          EventInputDto: {
            type: 'object',
            properties: {
              recurrence: {
                anyOf: [
                  { $ref: '#/components/schemas/Recurrence' },
                  { type: 'null' },
                ],
              },
            },
          },
          Recurrence: {
            type: 'object',
            properties: { freq: { type: 'string', enum: ['DAILY'] } },
          },
        },
      ),
    );

    expect(catalogue.actions[0].params['recurrence'].schema).toEqual({
      anyOf: [
        {
          type: 'object',
          properties: { freq: { type: 'string', enum: ['DAILY'] } },
        },
        { type: 'null' },
      ],
    });
  });

  it('range les actions par identifiant, pour un fichier stable', () => {
    const annotee = (operationId: string) => ({
      operationId,
      responses: {},
      'x-command': { ...CREER_UN_EVENEMENT, params: {} },
    });

    const catalogue = genererCatalogue(
      openapi({
        '/api/b': { post: annotee('B_creer') },
        '/api/a': { post: annotee('A_creer') },
      }),
    );

    expect(catalogue.actions.map(({ id }) => id)).toEqual([
      'A_creer',
      'B_creer',
    ]);
  });

  describe('échoue sur une annotation incohérente', () => {
    it('quand `params` nomme un champ absent du schéma d’entrée', () => {
      const generer = () =>
        genererCatalogue(
          openapi(
            {
              '/api/events': {
                post: {
                  operationId: 'EventController_creer',
                  requestBody: CORPS,
                  responses: {},
                  'x-command': {
                    ...CREER_UN_EVENEMENT,
                    params: { title: 'required', titre: 'optional' },
                  },
                },
              },
            },
            SCHEMAS,
          ),
        );

      expect(generer).toThrow(CatalogueIncoherent);
      expect(generer).toThrow(/EventController_creer.*« titre »/);
    });

    it("quand l'opération n'a aucun champ d'entrée", () => {
      expect(() =>
        genererCatalogue(
          openapi({
            '/api/agenda': {
              get: {
                operationId: 'AgendaController_lire',
                responses: {},
                'x-command': CREER_UN_EVENEMENT,
              },
            },
          }),
        ),
      ).toThrow(/AgendaController_lire.*« title »/);
    });

    it("quand l'annotation n'a pas la forme attendue", () => {
      const generer = () =>
        genererCatalogue(
          openapi(
            {
              '/api/events': {
                post: {
                  operationId: 'EventController_creer',
                  requestBody: CORPS,
                  responses: {},
                  'x-command': {
                    ...CREER_UN_EVENEMENT,
                    screen: 'calendrier/evenements/nouveau?title=x',
                    examples: [],
                  },
                },
              },
            },
            SCHEMAS,
          ),
        );

      expect(generer).toThrow(/EventController_creer : .*screen/);
      expect(generer).toThrow(/EventController_creer : .*examples/);
    });

    it("quand l'opération annotée n'a pas d'identifiant", () => {
      expect(() =>
        genererCatalogue(
          openapi({
            '/api/events': {
              post: { responses: {}, 'x-command': CREER_UN_EVENEMENT },
            },
          }),
        ),
      ).toThrow(/POST \/api\/events/);
    });

    it('quand deux opérations annotées portent le même identifiant', () => {
      const annotee = {
        operationId: 'EventController_creer',
        responses: {},
        'x-command': { ...CREER_UN_EVENEMENT, params: {} },
      };

      expect(() =>
        genererCatalogue(
          openapi({ '/api/a': { post: annotee }, '/api/b': { post: annotee } }),
        ),
      ).toThrow(/EventController_creer/);
    });

    it('en signalant toutes les incohérences à la fois', () => {
      const generer = () =>
        genererCatalogue(
          openapi(
            {
              '/api/events': {
                post: {
                  operationId: 'EventController_creer',
                  requestBody: CORPS,
                  responses: {},
                  'x-command': {
                    ...CREER_UN_EVENEMENT,
                    params: { a: 'optional' },
                  },
                },
                put: {
                  operationId: 'EventController_remplacer',
                  requestBody: CORPS,
                  responses: {},
                  'x-command': {
                    ...CREER_UN_EVENEMENT,
                    params: { b: 'optional' },
                  },
                },
              },
            },
            SCHEMAS,
          ),
        );

      expect(generer).toThrow(/EventController_creer : « a »/);
      expect(generer).toThrow(/EventController_remplacer : « b »/);
    });
  });
});
