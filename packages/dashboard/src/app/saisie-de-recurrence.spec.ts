import type { Recurrence } from '@personal-os/contracts';
import {
  memeRegle,
  SANS_REPETITION,
  versRegle,
  versSaisie,
  type SaisieDeRecurrence,
} from './saisie-de-recurrence';

const HEBDOMADAIRE: SaisieDeRecurrence = { ...SANS_REPETITION, active: true };

describe('La saisie de la répétition', () => {
  it("ne fait aucune règle quand l'Événement ne se répète pas", () => {
    expect(versRegle(SANS_REPETITION)).toBeNull();
    expect(versSaisie(null)).toEqual(SANS_REPETITION);
  });

  it('range les jours dans l’ordre de la semaine, quel que soit l’ordre des clics', () => {
    expect(versRegle({ ...HEBDOMADAIRE, jours: ['FR', 'MO', 'WE'] })).toEqual({
      freq: 'WEEKLY',
      interval: 1,
      byWeekday: ['MO', 'WE', 'FR'],
    });
  });

  it("n'envoie ni les jours d'une série mensuelle ni la fin d'un choix masqué", () => {
    expect(
      versRegle({
        ...HEBDOMADAIRE,
        frequence: 'MONTHLY',
        jours: ['MO'],
        fin: 'nombre',
        jusquAu: '2026-12-31',
        nombre: 4,
      }),
    ).toEqual({ freq: 'MONTHLY', interval: 1, count: 4 });
    expect(
      versRegle({ ...HEBDOMADAIRE, fin: 'date', jusquAu: '2026-12-31' }),
    ).toEqual({ freq: 'WEEKLY', interval: 1, until: '2026-12-31' });
  });

  it.each<[string, Partial<SaisieDeRecurrence>]>([
    ['un intervalle vide', { intervalle: NaN }],
    ['un intervalle nul', { intervalle: 0 }],
    ['un intervalle décimal', { intervalle: 1.5 }],
    ['une fin à une date sans date', { fin: 'date', jusquAu: '' }],
    ['une fin après zéro occurrence', { fin: 'nombre', nombre: 0 }],
  ])("attend une saisie complète : %s ne fait pas de règle", (_, champs) => {
    expect(versRegle({ ...HEBDOMADAIRE, ...champs })).toBeUndefined();
  });

  it('rend à l’écran la règle d’un Événement, et la retrouve telle quelle', () => {
    const regles: Recurrence[] = [
      { freq: 'DAILY', interval: 2, byWeekday: ['MO', 'TU'] },
      { freq: 'WEEKLY', interval: 1, until: '2027-01-31' },
      { freq: 'YEARLY', interval: 1, count: 3 },
    ];

    for (const regle of regles) {
      expect(versRegle(versSaisie(regle))).toEqual(regle);
    }
  });

  it("compare deux règles par ce qu'elles disent, et non par l'ordre de leurs clés", () => {
    expect(
      memeRegle(
        { freq: 'WEEKLY', interval: 1, byWeekday: ['WE', 'MO'] },
        { byWeekday: ['MO', 'WE'], interval: 1, freq: 'WEEKLY' },
      ),
    ).toBe(true);
    expect(
      memeRegle(
        { freq: 'WEEKLY', interval: 1 },
        { freq: 'WEEKLY', interval: 1, count: 2 },
      ),
    ).toBe(false);
    expect(memeRegle(null, { freq: 'DAILY', interval: 1 })).toBe(false);
    expect(memeRegle(null, null)).toBe(true);
  });
});
