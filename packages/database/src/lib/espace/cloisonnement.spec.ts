import { cloisonner, type OperationPrisma } from './cloisonnement';
import { ErreurDEspace, type RaisonDuRefus } from './erreur-d-espace';
import {
  lireLeSchema,
  RELATIONS_VERS_ESPACE,
  type ModeleDeDonnees,
} from './modeles';
import type { PorteeEspace } from './portee';

const MIEN = 'espace-personnel-a';
const FOYER = 'espace-foyer';
const SIEN = 'espace-personnel-b';

const PORTEE_COMPLETE: PorteeEspace = {
  espaces: [
    { id: MIEN, kind: 'PERSONAL' },
    { id: FOYER, kind: 'HOUSEHOLD' },
  ],
  typesAcceptes: ['PERSONAL', 'HOUSEHOLD'],
};

/**
 * Le schéma de test : ce que le client Prisma présenterait, avec en plus des
 * Recettes à deux niveaux de lignes, et un catalogue hors Espace. Il n'existe
 * pas dans `schema.prisma` : la garde se vérifie sur la forme d'un schéma,
 * pas sur les modules qui l'habitent aujourd'hui.
 */
const DONNEES: ModeleDeDonnees = {
  models: {
    Scope: modele({
      events: 'Event',
      eventExceptions: 'EventException',
      household: 'Household',
      holder: 'User',
    }),
    User: modele({
      household: 'Household',
      personalScope: 'Scope',
      sessions: 'Session',
    }),
    Session: modele({ user: 'User' }),
    Household: modele({ members: 'User', scopes: 'Scope' }),
    Event: modele({ scope: 'Scope', exceptions: 'EventException' }, true),
    EventException: modele({ scope: 'Scope', event: 'Event' }, true),
    Recipe: modele({ scope: 'Scope', lines: 'RecipeLine' }, true),
    RecipeLine: modele(
      {
        scope: 'Scope',
        recipe: 'Recipe',
        ingredient: 'Ingredient',
        notes: 'RecipeLineNote',
      },
      true,
    ),
    RecipeLineNote: modele({ scope: 'Scope', line: 'RecipeLine' }, true),
    Ingredient: modele({ lines: 'RecipeLine' }),
  },
};

const SCHEMA = lireLeSchema(DONNEES, {
  ...RELATIONS_VERS_ESPACE,
  Ingredient: ['lines'],
});

function modele(
  relations: Record<string, string>,
  porteUnEspace = false,
): ModeleDeDonnees['models'][string] {
  return {
    fields: [
      { name: 'id', kind: 'scalar', type: 'String' },
      ...(porteUnEspace
        ? [{ name: 'scopeId', kind: 'scalar', type: 'String' }]
        : []),
      ...Object.entries(relations).map(([name, type]) => ({
        name,
        kind: 'object',
        type,
      })),
    ],
  };
}

function garder(
  operation: OperationPrisma,
  portee: PorteeEspace | null,
): Record<string, unknown> {
  return cloisonner(operation, portee, SCHEMA);
}

function raisonDuRefus(geste: () => unknown): RaisonDuRefus | undefined {
  try {
    geste();
  } catch (erreur) {
    if (erreur instanceof ErreurDEspace) {
      return erreur.raison;
    }
    throw erreur;
  }
  return undefined;
}

describe('Cloisonnement par Espace', () => {
  it('refuse une écriture qui ne porte aucun Espace', () => {
    expect(() =>
      garder(
        { model: 'Event', operation: 'create', args: { data: { title: 'x' } } },
        PORTEE_COMPLETE,
      ),
    ).toThrow(/Espace/);
  });

  it("refuse une écriture vers un Espace que le module n'accepte pas", () => {
    const foyerSeul: PorteeEspace = {
      ...PORTEE_COMPLETE,
      typesAcceptes: ['HOUSEHOLD'],
    };

    expect(() =>
      garder(
        {
          model: 'Event',
          operation: 'create',
          args: { data: { title: 'x', scopeId: MIEN } },
        },
        foyerSeul,
      ),
    ).toThrow(/n'accepte pas/);
  });

  it('borne une lecture aux Espaces atteignables', () => {
    const args = garder(
      { model: 'Event', operation: 'findMany', args: {} },
      PORTEE_COMPLETE,
    );

    expect(args['where']).toEqual({
      AND: [{ scopeId: { in: [MIEN, FOYER] } }],
    });
  });

  it('laisse intact le filtre du module et lui ajoute le sien', () => {
    const args = garder(
      {
        model: 'Event',
        operation: 'findMany',
        args: { where: { title: 'x' } },
      },
      PORTEE_COMPLETE,
    );

    expect(args['where']).toEqual({
      title: 'x',
      AND: [{ scopeId: { in: [MIEN, FOYER] } }],
    });
  });

  it("écarte de la lecture les Espaces que le module n'accepte pas", () => {
    const args = garder(
      { model: 'Event', operation: 'findMany', args: {} },
      { ...PORTEE_COMPLETE, typesAcceptes: ['HOUSEHOLD'] },
    );

    expect(args['where']).toEqual({ AND: [{ scopeId: { in: [FOYER] } }] });
  });

  it('borne aussi une lecture par identifiant, pour que deviner ne serve à rien', () => {
    const args = garder(
      {
        model: 'Event',
        operation: 'findUnique',
        args: { where: { id: 'devine' } },
      },
      PORTEE_COMPLETE,
    );

    expect(args['where']).toEqual({
      id: 'devine',
      AND: [{ scopeId: { in: [MIEN, FOYER] } }],
    });
  });

  it('borne une modification et une suppression aux mêmes Espaces', () => {
    for (const operation of ['update', 'delete', 'updateMany', 'deleteMany']) {
      const args = garder(
        {
          model: 'Event',
          operation,
          args: { where: { id: 'devine' }, data: { scopeId: MIEN } },
        },
        PORTEE_COMPLETE,
      );

      expect(args['where']).toEqual({
        id: 'devine',
        AND: [{ scopeId: { in: [MIEN, FOYER] } }],
      });
    }
  });

  it("laisse modifier sans répéter l'Espace, que le filtre garantit déjà", () => {
    const args = garder(
      {
        model: 'Event',
        operation: 'update',
        args: { where: { id: 'x' }, data: { title: 'renommé' } },
      },
      PORTEE_COMPLETE,
    );

    expect(args['data']).toEqual({ title: 'renommé' });
  });

  it("vérifie l'Espace d'une modification qui déplace l'enregistrement", () => {
    expect(() =>
      garder(
        {
          model: 'Event',
          operation: 'update',
          args: { where: { id: 'x' }, data: { scopeId: SIEN } },
        },
        PORTEE_COMPLETE,
      ),
    ).toThrow(/hors de portée/);
  });

  it("n'invente pas de filtre là où l'opération n'en accepte aucun", () => {
    const args = garder(
      {
        model: 'Event',
        operation: 'create',
        args: { data: { title: 'x', scopeId: MIEN } },
      },
      PORTEE_COMPLETE,
    );

    expect(args).not.toHaveProperty('where');
  });

  it("vérifie les deux branches d'un upsert", () => {
    expect(() =>
      garder(
        {
          model: 'Event',
          operation: 'upsert',
          args: {
            where: { id: 'x' },
            create: { title: 'x', scopeId: MIEN },
            update: { scopeId: SIEN },
          },
        },
        PORTEE_COMPLETE,
      ),
    ).toThrow(/hors de portée/);
  });

  it("laisse passer un modèle qui ne porte pas d'Espace", () => {
    const args = garder(
      { model: 'User', operation: 'findMany', args: {} },
      PORTEE_COMPLETE,
    );

    expect(args).toEqual({});
  });

  it("refuse d'atteindre un modèle cloisonné par une écriture imbriquée", () => {
    expect(() =>
      garder(
        {
          model: 'Scope',
          operation: 'update',
          args: {
            where: { id: FOYER },
            data: { events: { create: { title: 'contournement' } } },
          },
        },
        PORTEE_COMPLETE,
      ),
    ).toThrow(/imbriqu/);
  });

  it('refuse un chemin imbriqué comme un défaut du module', () => {
    expect(
      raisonDuRefus(() =>
        garder(
          {
            model: 'Scope',
            operation: 'update',
            args: {
              where: { id: FOYER },
              data: { events: { create: { title: 'contournement' } } },
            },
          },
          PORTEE_COMPLETE,
        ),
      ),
    ).toBe('imbrication');
  });

  it('refuse aussi un chemin imbriqué qui traverse plusieurs modèles hors Espace', () => {
    expect(() =>
      garder(
        {
          model: 'User',
          operation: 'update',
          args: {
            where: { id: 'compte-a' },
            data: {
              personalScope: {
                update: {
                  events: { create: { title: 'contournement' } },
                },
              },
            },
          },
        },
        PORTEE_COMPLETE,
      ),
    ).toThrow(/imbriqu/);
  });

  it("refuse une écriture imbriquée d'un modèle cloisonné vers un autre", () => {
    // La garde ne vérifierait que l'Espace de l'Événement : l'exception
    // imbriquée, elle, passerait sans contrôle.
    expect(() =>
      garder(
        {
          model: 'Event',
          operation: 'create',
          args: {
            data: {
              title: 'Réunion',
              scopeId: MIEN,
              exceptions: { create: { scopeId: SIEN, kind: 'CANCELLED' } },
            },
          },
        },
        PORTEE_COMPLETE,
      ),
    ).toThrow(/imbriqu/);
  });

  it('refuse de rattacher un modèle cloisonné à un autre par sa relation', () => {
    expect(() =>
      garder(
        {
          model: 'EventException',
          operation: 'create',
          args: {
            data: {
              scopeId: MIEN,
              kind: 'CANCELLED',
              event: { connect: { id: 'event-de-b' } },
            },
          },
        },
        PORTEE_COMPLETE,
      ),
    ).toThrow(/imbriqu/);
  });

  it("vérifie chaque rangée d'une écriture multiple sur un modèle relié", () => {
    expect(() =>
      garder(
        {
          model: 'EventException',
          operation: 'createMany',
          args: {
            data: [
              { scopeId: MIEN, eventId: 'event-1', kind: 'CANCELLED' },
              { scopeId: SIEN, eventId: 'event-2', kind: 'CANCELLED' },
            ],
          },
        },
        PORTEE_COMPLETE,
      ),
    ).toThrow(/hors de portée/);
  });

  it('laisse écrire un modèle relié par ses seules clés, que la base vérifie', () => {
    const args = garder(
      {
        model: 'EventException',
        operation: 'create',
        args: {
          data: { scopeId: MIEN, eventId: 'event-1', kind: 'CANCELLED' },
        },
      },
      PORTEE_COMPLETE,
    );

    expect(args['data']).toEqual({
      scopeId: MIEN,
      eventId: 'event-1',
      kind: 'CANCELLED',
    });
  });

  it('refuse une requête cloisonnée qui ne traverse aucune portée', () => {
    expect(() =>
      garder({ model: 'Event', operation: 'findMany', args: {} }, null),
    ).toThrow(/portée/);
  });

  it("laisse passer hors portée ce qui ne porte pas d'Espace", () => {
    expect(
      garder({ model: 'Session', operation: 'findFirst', args: {} }, null),
    ).toEqual({});
  });

  it("refuse une écriture vers l'Espace personnel de l'autre compte", () => {
    expect(() =>
      garder(
        {
          model: 'Event',
          operation: 'create',
          args: { data: { title: 'x', scopeId: SIEN } },
        },
        PORTEE_COMPLETE,
      ),
    ).toThrow(/hors de portée/);
  });
  describe('Écritures imbriquées entre modèles cloisonnés', () => {
    const ligne = (contenu: Record<string, unknown> = {}) => ({
      quantity: 1,
      ...contenu,
    });

    function creerRecette(lines: unknown): () => Record<string, unknown> {
      return () =>
        garder(
          {
            model: 'Recipe',
            operation: 'create',
            args: { data: { title: 'Gratin', scopeId: MIEN, lines } },
          },
          PORTEE_COMPLETE,
        );
    }

    it("laisse créer des lignes sur deux niveaux, qui prennent l'Espace de leur parent", () => {
      // La clé étrangère d'une ligne porte l'Espace (modeles.spec.ts) :
      // Prisma le tire du parent, et refuserait qu'on le répète.
      const lines = {
        create: [
          ligne({ notes: { create: { text: 'râpé' } } }),
          ligne({ notes: { createMany: { data: [{ text: 'fin' }] } } }),
        ],
      };

      expect(creerRecette(lines)()['data']).toEqual({
        title: 'Gratin',
        scopeId: MIEN,
        lines,
      });
    });

    it("accepte une ligne qui nomme l'Espace de son parent", () => {
      expect(
        raisonDuRefus(
          creerRecette({
            create: ligne({
              scopeId: MIEN,
              notes: {
                createMany: { data: [{ scopeId: MIEN, text: 'fin' }] },
              },
            }),
          }),
        ),
      ).toBeUndefined();
    });

    it.each([
      ['une ligne', { create: ligne({ scopeId: FOYER }) }],
      [
        'une ligne créée en lot',
        {
          createMany: {
            data: [ligne({ scopeId: MIEN }), ligne({ scopeId: FOYER })],
          },
        },
      ],
      [
        'une ligne rattachée à un autre Espace',
        { create: ligne({ scope: { connect: { id: FOYER } } }) },
      ],
      [
        'une ligne de second niveau',
        { create: ligne({ notes: { create: { scopeId: FOYER, text: 'x' } } }) },
      ],
      [
        'une ligne de second niveau créée en lot',
        {
          create: ligne({
            notes: { createMany: { data: [{ scopeId: SIEN, text: 'x' }] } },
          }),
        },
      ],
    ])('refuse %s qui nomme un autre Espace que son parent', (_, lines) => {
      // Même un Espace atteignable : la ligne et sa Recette n'en ont qu'un.
      expect(raisonDuRefus(creerRecette(lines))).toBe('imbrication');
    });

    it.each([
      'connect',
      'connectOrCreate',
      'set',
      'update',
      'updateMany',
      'upsert',
      'delete',
      'deleteMany',
      'disconnect',
    ])(
      'refuse un %s imbriqué vers un modèle cloisonné, sur deux niveaux',
      (geste) => {
        expect(
          raisonDuRefus(creerRecette({ [geste]: { id: 'ligne-de-b' } })),
        ).toBe('imbrication');
        expect(
          raisonDuRefus(
            creerRecette({
              create: ligne({ notes: { [geste]: { id: 'note-de-b' } } }),
            }),
          ),
        ).toBe('imbrication');
      },
    );

    it('refuse aussi un geste imbriqué sous une modification', () => {
      expect(
        raisonDuRefus(() =>
          garder(
            {
              model: 'Recipe',
              operation: 'update',
              args: {
                where: { id: 'x' },
                data: { lines: { deleteMany: {} } },
              },
            },
            PORTEE_COMPLETE,
          ),
        ),
      ).toBe('imbrication');
    });

    it('laisse rattacher par connect un modèle hors Espace, sur deux niveaux', () => {
      expect(
        raisonDuRefus(
          creerRecette({
            create: ligne({ ingredient: { connect: { id: 'beurre' } } }),
          }),
        ),
      ).toBeUndefined();
    });

    it('refuse de créer un modèle hors Espace par une ligne imbriquée', () => {
      expect(
        raisonDuRefus(
          creerRecette({
            create: ligne({ ingredient: { create: { name: 'beurre' } } }),
          }),
        ),
      ).toBe('imbrication');
    });

    it("refuse qu'une ligne créée sous une modification nomme un Espace", () => {
      // Le parent n'y nomme pas le sien : la garde ne le connaît pas, et ne
      // peut donc pas vérifier que la ligne est dans le même.
      const ajouter = (scopeId: string) => () =>
        garder(
          {
            model: 'Recipe',
            operation: 'update',
            args: {
              where: { id: 'x' },
              data: { lines: { create: ligne({ scopeId }) } },
            },
          },
          PORTEE_COMPLETE,
        );

      expect(raisonDuRefus(ajouter(SIEN))).toBe('imbrication');
      expect(raisonDuRefus(ajouter(MIEN))).toBe('imbrication');
    });

    it('refuse de déplacer une ligne en créant son parent sous une modification', () => {
      // La clé étrangère de l'exception porte l'Espace : créer un Événement
      // du foyer et l'y rattacher déplacerait l'exception personnelle.
      expect(
        raisonDuRefus(() =>
          garder(
            {
              model: 'EventException',
              operation: 'update',
              args: {
                where: { id: 'exception-personnelle' },
                data: {
                  event: { create: { title: 'Réunion', scopeId: FOYER } },
                },
              },
            },
            PORTEE_COMPLETE,
          ),
        ),
      ).toBe('imbrication');
    });

    it("laisse créer sous une modification une ligne qui ne nomme pas d'Espace", () => {
      // La clé étrangère la place dans l'Espace de son parent.
      expect(
        raisonDuRefus(() =>
          garder(
            {
              model: 'Recipe',
              operation: 'update',
              args: {
                where: { id: 'x' },
                data: {
                  lines: {
                    create: ligne({ notes: { create: { text: 'fin' } } }),
                  },
                },
              },
            },
            PORTEE_COMPLETE,
          ),
        ),
      ).toBeUndefined();
    });

    it("compare les lignes à l'Espace vers lequel une modification déplace le parent", () => {
      const deplacerEtAjouter = (scopeId: string) => () =>
        garder(
          {
            model: 'Recipe',
            operation: 'update',
            args: {
              where: { id: 'x' },
              data: { scopeId: FOYER, lines: { create: ligne({ scopeId }) } },
            },
          },
          PORTEE_COMPLETE,
        );

      expect(raisonDuRefus(deplacerEtAjouter(FOYER))).toBeUndefined();
      expect(raisonDuRefus(deplacerEtAjouter(MIEN))).toBe('imbrication');
    });

    it("vérifie l'Espace nommé par la relation plutôt que par la clé", () => {
      const deplacer = (scope: unknown) => () =>
        garder(
          {
            model: 'Event',
            operation: 'update',
            args: { where: { id: 'x' }, data: { scope } },
          },
          PORTEE_COMPLETE,
        );

      expect(raisonDuRefus(deplacer({ connect: { id: SIEN } }))).toBe(
        'hors-portee',
      );
      expect(
        raisonDuRefus(deplacer({ connect: { id: FOYER } })),
      ).toBeUndefined();
      expect(raisonDuRefus(deplacer({ update: { label: 'renommé' } }))).toBe(
        'imbrication',
      );
    });
  });
});
