import { zEventInput, zRecurrence } from './event';

/** Les chemins des champs qu'un schéma refuse, comme `fields` les rendra. */
function cheminsRefuses(resultat: {
  success: boolean;
  error?: { issues: { path: PropertyKey[] }[] };
}): string[] {
  return (resultat.error?.issues ?? []).map(({ path }) => path.join('.'));
}

describe('zRecurrence', () => {
  it('accepte une règle hebdomadaire sur deux jours, sans fin', () => {
    expect(
      zRecurrence.parse({
        freq: 'WEEKLY',
        interval: 1,
        byWeekday: ['MO', 'TH'],
      }),
    ).toEqual({ freq: 'WEEKLY', interval: 1, byWeekday: ['MO', 'TH'] });
  });

  it.each([
    ['une fin par date', { until: '2027-06-30' }],
    ['une fin par nombre', { count: 10 }],
  ])('accepte %s', (_cas, fin) => {
    expect(
      zRecurrence.safeParse({ freq: 'MONTHLY', interval: 1, ...fin }).success,
    ).toBe(true);
  });

  it('refuse une fin par date et par nombre à la fois, sur `count`', () => {
    const resultat = zRecurrence.safeParse({
      freq: 'DAILY',
      interval: 1,
      until: '2027-06-30',
      count: 10,
    });

    expect(cheminsRefuses(resultat)).toEqual(['count']);
  });

  it.each([
    ['un intervalle nul', { interval: 0 }, 'interval'],
    ['un intervalle fractionnaire', { interval: 1.5 }, 'interval'],
    ['un nombre nul', { interval: 1, count: 0 }, 'count'],
    [
      'une fin qui n’est pas un jour',
      { interval: 1, until: '2027-06-31' },
      'until',
    ],
    ['une liste de jours vide', { interval: 1, byWeekday: [] }, 'byWeekday'],
    ['un jour inconnu', { interval: 1, byWeekday: ['LU'] }, 'byWeekday.0'],
    ['un jour répété', { interval: 1, byWeekday: ['MO', 'MO'] }, 'byWeekday'],
  ])('refuse %s', (_cas, regle, chemin) => {
    const resultat = zRecurrence.safeParse({ freq: 'WEEKLY', ...regle });

    expect(cheminsRefuses(resultat)).toEqual([chemin]);
  });

  it('refuse une fréquence inconnue', () => {
    expect(
      cheminsRefuses(zRecurrence.safeParse({ freq: 'HOURLY', interval: 1 })),
    ).toEqual(['freq']);
  });

  it.each(['MONTHLY', 'YEARLY'])(
    'refuse des jours de la semaine sur une règle %s',
    (freq) => {
      const resultat = zRecurrence.safeParse({
        freq,
        interval: 1,
        byWeekday: ['MO'],
      });

      expect(cheminsRefuses(resultat)).toEqual(['byWeekday']);
    },
  );

  it('accepte des jours de la semaine sur une règle quotidienne, qui les filtre', () => {
    expect(
      zRecurrence.safeParse({
        freq: 'DAILY',
        interval: 1,
        byWeekday: ['MO', 'TU', 'WE', 'TH', 'FR'],
      }).success,
    ).toBe(true);
  });
});

describe('zEventInput', () => {
  const SAISIE = {
    title: 'Réunion',
    startsAt: '2026-10-19T07:00:00.000Z',
    category: 'OTHER',
    scopeId: 'espace-a',
  };

  it('laisse un Événement sans récurrence', () => {
    expect(zEventInput.parse(SAISIE).recurrence).toBeUndefined();
  });

  it('accepte une récurrence nommée vide, pour la retirer', () => {
    expect(
      zEventInput.parse({ ...SAISIE, recurrence: null }).recurrence,
    ).toBeNull();
  });

  it('pointe le champ fautif de la récurrence', () => {
    const resultat = zEventInput.safeParse({
      ...SAISIE,
      recurrence: { freq: 'DAILY', interval: 0 },
    });

    expect(cheminsRefuses(resultat)).toEqual(['recurrence.interval']);
  });
});
