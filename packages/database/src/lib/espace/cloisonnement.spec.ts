import { cloisonner } from './cloisonnement';
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

describe('Cloisonnement par Espace', () => {
  it('refuse une écriture qui ne porte aucun Espace', () => {
    expect(() =>
      cloisonner(
        { model: 'Trace', operation: 'create', args: { data: { label: 'x' } } },
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
      cloisonner(
        {
          model: 'Trace',
          operation: 'create',
          args: { data: { label: 'x', scopeId: MIEN } },
        },
        foyerSeul,
      ),
    ).toThrow(/n'accepte pas/);
  });

  it('borne une lecture aux Espaces atteignables', () => {
    const args = cloisonner(
      { model: 'Trace', operation: 'findMany', args: {} },
      PORTEE_COMPLETE,
    );

    expect(args['where']).toEqual({
      AND: [{ scopeId: { in: [MIEN, FOYER] } }],
    });
  });

  it("laisse intact le filtre du module et lui ajoute le sien", () => {
    const args = cloisonner(
      {
        model: 'Trace',
        operation: 'findMany',
        args: { where: { label: 'x' } },
      },
      PORTEE_COMPLETE,
    );

    expect(args['where']).toEqual({
      label: 'x',
      AND: [{ scopeId: { in: [MIEN, FOYER] } }],
    });
  });

  it("écarte de la lecture les Espaces que le module n'accepte pas", () => {
    const args = cloisonner(
      { model: 'Trace', operation: 'findMany', args: {} },
      { ...PORTEE_COMPLETE, typesAcceptes: ['HOUSEHOLD'] },
    );

    expect(args['where']).toEqual({ AND: [{ scopeId: { in: [FOYER] } }] });
  });

  it("borne aussi une lecture par identifiant, pour que deviner ne serve à rien", () => {
    const args = cloisonner(
      {
        model: 'Trace',
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
      const args = cloisonner(
        {
          model: 'Trace',
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
    const args = cloisonner(
      {
        model: 'Trace',
        operation: 'update',
        args: { where: { id: 'x' }, data: { label: 'renommée' } },
      },
      PORTEE_COMPLETE,
    );

    expect(args['data']).toEqual({ label: 'renommée' });
  });

  it("vérifie l'Espace d'une modification qui déplace l'enregistrement", () => {
    expect(() =>
      cloisonner(
        {
          model: 'Trace',
          operation: 'update',
          args: { where: { id: 'x' }, data: { scopeId: SIEN } },
        },
        PORTEE_COMPLETE,
      ),
    ).toThrow(/hors de portée/);
  });

  it("n'invente pas de filtre là où l'opération n'en accepte aucun", () => {
    const args = cloisonner(
      {
        model: 'Trace',
        operation: 'create',
        args: { data: { label: 'x', scopeId: MIEN } },
      },
      PORTEE_COMPLETE,
    );

    expect(args).not.toHaveProperty('where');
  });

  it("vérifie les deux branches d'un upsert", () => {
    expect(() =>
      cloisonner(
        {
          model: 'Trace',
          operation: 'upsert',
          args: {
            where: { id: 'x' },
            create: { label: 'x', scopeId: MIEN },
            update: { scopeId: SIEN },
          },
        },
        PORTEE_COMPLETE,
      ),
    ).toThrow(/hors de portée/);
  });

  it('laisse passer un modèle qui ne porte pas d\'Espace', () => {
    const args = cloisonner(
      { model: 'User', operation: 'findMany', args: {} },
      PORTEE_COMPLETE,
    );

    expect(args).toEqual({});
  });

  it("refuse d'atteindre un modèle cloisonné par une écriture imbriquée", () => {
    expect(() =>
      cloisonner(
        {
          model: 'Scope',
          operation: 'update',
          args: {
            where: { id: FOYER },
            data: { traces: { create: { label: 'contournement' } } },
          },
        },
        PORTEE_COMPLETE,
      ),
    ).toThrow(/imbriqu/);
  });

  it('refuse une requête cloisonnée qui ne traverse aucune portée', () => {
    expect(() =>
      cloisonner({ model: 'Trace', operation: 'findMany', args: {} }, null),
    ).toThrow(/portée/);
  });

  it("laisse passer hors portée ce qui ne porte pas d'Espace", () => {
    expect(
      cloisonner({ model: 'Session', operation: 'findFirst', args: {} }, null),
    ).toEqual({});
  });

  it("refuse une écriture vers l'Espace personnel de l'autre compte", () => {
    expect(() =>
      cloisonner(
        {
          model: 'Trace',
          operation: 'create',
          args: { data: { label: 'x', scopeId: SIEN } },
        },
        PORTEE_COMPLETE,
      ),
    ).toThrow(/hors de portée/);
  });
});
