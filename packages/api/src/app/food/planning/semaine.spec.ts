import { estDansLaSemaine, joursDeLaSemaine } from './semaine';

describe('joursDeLaSemaine', () => {
  it('donne les sept jours, du lundi au dimanche', () => {
    expect(joursDeLaSemaine('2028-03-13')).toEqual([
      '2028-03-13',
      '2028-03-14',
      '2028-03-15',
      '2028-03-16',
      '2028-03-17',
      '2028-03-18',
      '2028-03-19',
    ]);
  });

  it('passe le mois et l’année', () => {
    expect(joursDeLaSemaine('2027-12-27').slice(4)).toEqual([
      '2027-12-31',
      '2028-01-01',
      '2028-01-02',
    ]);
  });

  it('refuse un jour qui n’est pas un lundi', () => {
    expect(() => joursDeLaSemaine('2028-03-15')).toThrow();
  });
});

describe('estDansLaSemaine', () => {
  it.each([
    ['2028-03-13', true],
    ['2028-03-19', true],
    ['2028-03-12', false],
    ['2028-03-20', false],
  ])('%s est dans la semaine du 13 mars : %s', (jour, attendu) => {
    expect(estDansLaSemaine(jour, '2028-03-13')).toBe(attendu);
  });
});
