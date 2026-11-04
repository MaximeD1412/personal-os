import type { ModuleSummary, Signal } from '@personal-os/contracts';
import { aFaire } from './a-faire';

/**
 * Les modules de ces résumés sont inventés, et c'est le sujet : le Calculateur
 * d'À faire ne connaît aucun module (ADR 0011).
 */
function resume(module: string, signals: Partial<Signal>[]): ModuleSummary {
  return {
    module,
    indicators: [
      { key: 'sans-importance', label: 'Sans importance', value: 1 },
    ],
    signals: signals.map((signal, rang) => ({
      kind: `${module}.situation`,
      ref: `${module}-${rang}`,
      label: `Situation ${rang} de ${module}`,
      link: `/${module}`,
      ...signal,
    })),
  };
}

describe("Le Calculateur d'À faire", () => {
  it("n'a rien à faire quand aucun module ne signale rien", () => {
    expect(aFaire([resume('alpha', []), resume('beta', [])])).toEqual([]);
  });

  it('fait de chaque signal un À faire, avec son module et le lien qui le résout', () => {
    expect(
      aFaire([
        resume('alpha', [
          {
            kind: 'alpha.en_retard',
            ref: 'objet-1',
            label: 'Objet en retard',
            dueOn: '2033-03-10',
            link: '/alpha/objets/objet-1',
          },
        ]),
      ]),
    ).toEqual([
      {
        module: 'alpha',
        kind: 'alpha.en_retard',
        ref: 'objet-1',
        label: 'Objet en retard',
        dueOn: '2033-03-10',
        link: '/alpha/objets/objet-1',
      },
    ]);
  });

  it("met l'échéance la plus proche d'abord, tous modules confondus", () => {
    const todos = aFaire([
      resume('alpha', [{ ref: 'tard', dueOn: '2033-03-20' }]),
      resume('beta', [
        { ref: 'bientot', dueOn: '2033-03-11' },
        { ref: 'passe', dueOn: '2033-03-01' },
      ]),
    ]);

    expect(todos.map(({ ref }) => ref)).toEqual(['passe', 'bientot', 'tard']);
  });

  it("range après les autres ce qui n'a pas d'échéance, dans l'ordre des modules", () => {
    const todos = aFaire([
      resume('alpha', [{ ref: 'sans-date-1' }]),
      resume('beta', [
        { ref: 'date', dueOn: '2040-01-01' },
        { ref: 'sans-date-2' },
      ]),
    ]);

    expect(todos.map(({ ref }) => ref)).toEqual([
      'date',
      'sans-date-1',
      'sans-date-2',
    ]);
  });

  it("n'invente pas d'échéance à ce qui n'en a pas", () => {
    const [todo] = aFaire([resume('alpha', [{ ref: 'sans-date' }])]);

    expect(todo).not.toHaveProperty('dueOn');
  });
});
