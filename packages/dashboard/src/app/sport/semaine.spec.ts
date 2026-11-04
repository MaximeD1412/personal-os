import {
  decalerLaSemaine,
  estUneSemaine,
  heureDe,
  jourDe,
  libelleDeLaSemaine,
  semaineDe,
} from './semaine';

describe('La semaine du Sport', () => {
  it('reconnaît une semaine à son lundi', () => {
    expect(estUneSemaine('2026-10-19')).toBe(true);
    expect(estUneSemaine('2026-10-20')).toBe(false);
    expect(estUneSemaine(null)).toBe(false);
  });

  it('trouve la semaine, à Paris, d’un instant', () => {
    // 22 h 30 UTC : 23 h 30 à Paris, encore le dimanche.
    expect(semaineDe('2026-10-25T22:30:00.000Z')).toBe('2026-10-19');
    // 23 h 30 UTC, encore dimanche : 0 h 30 lundi à Paris.
    expect(semaineDe('2026-10-25T23:30:00.000Z')).toBe('2026-10-26');
  });

  it('avance et recule d’une semaine, d’une année à l’autre', () => {
    expect(decalerLaSemaine('2026-12-28', 1)).toBe('2027-01-04');
    expect(decalerLaSemaine('2026-10-19', -1)).toBe('2026-10-12');
  });

  it.each([
    ['2026-10-19', 'Semaine du 19 au 25 octobre 2026'],
    ['2025-05-26', 'Semaine du 26 mai au 1er juin 2025'],
    ['2026-12-28', 'Semaine du 28 décembre 2026 au 3 janvier 2027'],
  ])('nomme la semaine du %s', (lundi, libelle) => {
    expect(libelleDeLaSemaine(lundi)).toBe(libelle);
  });

  it('lit le jour et l’heure d’une Séance à Paris', () => {
    expect(jourDe('2026-10-20T05:15:00.000Z')).toEqual({
      jour: 'mar.',
      numero: '20',
    });
    expect(heureDe('2026-10-20T05:15:00.000Z')).toBe('07:15');
  });
});
