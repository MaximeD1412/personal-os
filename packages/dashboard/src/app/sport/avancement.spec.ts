import { avancementDe, echeanceDe } from './avancement';

describe("L'avancement d'un Objectif", () => {
  it('compte les Séances faites sur toutes celles qui y mènent', () => {
    expect(avancementDe({ done: 3, missed: 1, planned: 2 })).toEqual({
      faites: 3,
      total: 6,
      pourcentage: 50,
      libelle: '3 / 6 faites',
      detail: '1 manquée · 2 à venir',
    });
  });

  it('dit zéro, sans diviser, quand aucune Séance n’y mène', () => {
    expect(avancementDe({ done: 0, missed: 0, planned: 0 })).toEqual({
      faites: 0,
      total: 0,
      pourcentage: 0,
      libelle: 'Aucune séance',
      detail: 'Aucune séance planifiée',
    });
  });

  it('accorde au pluriel, et arrondit le pourcentage', () => {
    expect(avancementDe({ done: 1, missed: 2, planned: 0 })).toMatchObject({
      pourcentage: 33,
      detail: '2 manquées · 0 à venir',
    });
  });
});

describe("L'échéance d'un Objectif", () => {
  it('compte les jours jusqu’à la date, depuis aujourd’hui', () => {
    expect(echeanceDe('2026-12-12', '2026-11-04')).toEqual({
      libelle: 'Dans 38 jours',
      passee: false,
    });
    expect(echeanceDe('2026-11-05', '2026-11-04')).toEqual({
      libelle: 'Demain',
      passee: false,
    });
  });

  it('dit le jour même, puis le passé', () => {
    expect(echeanceDe('2026-11-04', '2026-11-04')).toEqual({
      libelle: "Aujourd'hui",
      passee: false,
    });
    expect(echeanceDe('2026-10-04', '2026-11-04')).toEqual({
      libelle: 'Passé',
      passee: true,
    });
  });

  it('ne se trompe pas au changement d’heure', () => {
    expect(echeanceDe('2026-10-26', '2026-10-24').libelle).toBe('Dans 2 jours');
  });
});
