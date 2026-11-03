import { seancesDeLaSemaine } from './training';

/** Le lundi 19 octobre 2026, minuit à Paris. */
const LUNDI = new Date('2026-10-18T22:00:00.000Z');
const SEMAINE_MS = 7 * 24 * 3_600_000;

const aUnPrevu = (s: ReturnType<typeof seancesDeLaSemaine>[number]) =>
  [s.plannedDistanceM, s.plannedDurationS, s.plannedIntent].some(
    (valeur) => valeur != null,
  );
const aUnRealise = (s: ReturnType<typeof seancesDeLaSemaine>[number]) =>
  [s.actualDistanceM, s.actualDurationS, s.actualNotes].some(
    (valeur) => valeur != null,
  );

describe('Le semeur de démo du Sport', () => {
  const seances = seancesDeLaSemaine(LUNDI, 'espace-a');

  it('sème une semaine de Séances dans l’Espace donné', () => {
    expect(seances.length).toBeGreaterThanOrEqual(4);
    for (const seance of seances) {
      const debut = new Date(seance.startsAt).getTime();
      expect(seance.scopeId).toBe('espace-a');
      expect(debut).toBeGreaterThanOrEqual(LUNDI.getTime());
      expect(debut).toBeLessThan(LUNDI.getTime() + SEMAINE_MS);
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

  it('est déterministe : la même semaine donne les mêmes Séances', () => {
    expect(seancesDeLaSemaine(LUNDI, 'espace-a')).toEqual(seances);
  });
});
