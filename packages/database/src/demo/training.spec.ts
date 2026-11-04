import { aParis, decalerLeJour } from './dates';
import type { Demo } from './seeder';
import { seancesDeDemo, training } from './training';

/** Le mercredi 4 novembre 2026, jour du semis. */
const AUJOURDHUI = '2026-11-04';
const MAINTENANT = aParis(AUJOURDHUI, '12:00');

const DEMO: Demo = {
  a: { email: 'a@demo.test', userId: 'compte-a', espacePersonnel: 'espace-a' },
  b: { email: 'b@demo.test', userId: 'compte-b', espacePersonnel: 'espace-b' },
  espaceFoyer: 'espace-foyer',
  aujourdhui: AUJOURDHUI,
  le: (decalage, heure) => aParis(decalerLeJour(AUJOURDHUI, decalage), heure),
};

type SeanceSemee = ReturnType<typeof seancesDeDemo>[number];

const aUnPrevu = (s: SeanceSemee) =>
  [s.plannedDistanceM, s.plannedDurationS, s.plannedIntent].some(
    (valeur) => valeur != null,
  );
const aUnRealise = (s: SeanceSemee) =>
  [s.actualDistanceM, s.actualDurationS, s.actualNotes].some(
    (valeur) => valeur != null,
  );

describe('Le semeur de démo du Sport', () => {
  const seances = seancesDeDemo(DEMO);

  it('ne sème que dans les Espaces personnels, comme le module', () => {
    expect(training.espaces).toEqual(['PERSONAL']);
    expect(training.modeles).toEqual(['TrainingSession']);
    expect(new Set(seances.map(({ scopeId }) => scopeId))).toEqual(
      new Set(['espace-a', 'espace-b']),
    );
  });

  it('cale ses Séances sur les jours autour du semis, à moins d’une semaine', () => {
    const SEMAINE_MS = 7 * 24 * 3_600_000;
    for (const { startsAt } of seances) {
      const ecart = new Date(startsAt).getTime() - MAINTENANT.getTime();
      expect(Math.abs(ecart)).toBeLessThan(SEMAINE_MS);
    }
  });

  it('ne laisse prévue qu’une Séance à venir, et n’achève que le passé', () => {
    for (const { status, startsAt } of seances) {
      const avenir = new Date(startsAt).getTime() > MAINTENANT.getTime();
      expect(status === 'PLANNED').toBe(avenir);
    }
  });

  it('en compte une manquée, qui garde son prévu sans réalisé', () => {
    const manquees = seances.filter((s) => s.status === 'MISSED');

    expect(manquees).not.toHaveLength(0);
    expect(manquees.every((s) => aUnPrevu(s) && !aUnRealise(s))).toBe(true);
  });

  it('et une non planifiée : réalisée, sans prévu', () => {
    expect(
      seances.some((s) => s.status === 'DONE' && !aUnPrevu(s) && aUnRealise(s)),
    ).toBe(true);
  });

  it('ne sème que des Séances que l’API accepterait', () => {
    for (const seance of seances) {
      if (seance.status === 'PLANNED') {
        expect(aUnPrevu(seance) && !aUnRealise(seance)).toBe(true);
      }
      if (seance.status === 'DONE') {
        expect(aUnRealise(seance)).toBe(true);
      }
    }
  });

  it('est déterministe : le même jour donne les mêmes Séances', () => {
    expect(seancesDeDemo(DEMO)).toEqual(seances);
  });
});
