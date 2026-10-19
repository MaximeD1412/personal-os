import {
  titreDeSeance,
  zTrainingSessionCompletion,
  zTrainingSessionInput,
} from './training';

function cheminsRefuses(resultat: {
  success: boolean;
  error?: { issues: { path: PropertyKey[] }[] };
}): string[] {
  return (resultat.error?.issues ?? []).map(({ path }) => path.join('.'));
}

const DEBUT = '2026-10-20T06:30:00.000Z';

describe('zTrainingSessionInput', () => {
  it('accepte une Séance prévue avec son prévu', () => {
    expect(
      zTrainingSessionInput.safeParse({
        startsAt: DEBUT,
        sport: 'RUN',
        status: 'PLANNED',
        plannedDistanceM: 10_000,
      }).success,
    ).toBe(true);
  });

  it('accepte une sortie non planifiée, réalisée et sans prévu', () => {
    expect(
      zTrainingSessionInput.safeParse({
        startsAt: DEBUT,
        sport: 'BIKE',
        status: 'DONE',
        actualDurationS: 3_600,
      }).success,
    ).toBe(true);
  });

  it('refuse un réalisé sur une Séance prévue, sur le champ du réalisé', () => {
    const resultat = zTrainingSessionInput.safeParse({
      startsAt: DEBUT,
      sport: 'RUN',
      status: 'PLANNED',
      plannedDistanceM: 10_000,
      actualDistanceM: 10_200,
    });

    expect(cheminsRefuses(resultat)).toEqual(['actualDistanceM']);
  });

  it('refuse un prévu sur une sortie non planifiée', () => {
    const resultat = zTrainingSessionInput.safeParse({
      startsAt: DEBUT,
      sport: 'RUN',
      status: 'DONE',
      plannedIntent: 'Footing',
      actualDurationS: 1_800,
    });

    expect(cheminsRefuses(resultat)).toEqual(['plannedIntent']);
  });

  it.each([
    ['prévue sans prévu', 'PLANNED', 'plannedDistanceM'],
    ['réalisée sans réalisé', 'DONE', 'actualDistanceM'],
  ])('refuse une Séance %s', (_cas, status, chemin) => {
    const resultat = zTrainingSessionInput.safeParse({
      startsAt: DEBUT,
      sport: 'SWIM',
      status,
    });

    expect(cheminsRefuses(resultat)).toEqual([chemin]);
  });

  it('refuse de créer une Séance déjà manquée', () => {
    const resultat = zTrainingSessionInput.safeParse({
      startsAt: DEBUT,
      sport: 'RUN',
      status: 'MISSED',
      plannedDistanceM: 5_000,
    });

    expect(cheminsRefuses(resultat)).toContain('status');
  });

  it('refuse une distance qui n’est pas un entier de mètres', () => {
    const resultat = zTrainingSessionInput.safeParse({
      startsAt: DEBUT,
      sport: 'RUN',
      status: 'PLANNED',
      plannedDistanceM: 10.5,
    });

    expect(cheminsRefuses(resultat)).toEqual(['plannedDistanceM']);
  });
});

describe('zTrainingSessionCompletion', () => {
  it('exige au moins une valeur réalisée', () => {
    expect(cheminsRefuses(zTrainingSessionCompletion.safeParse({}))).toEqual([
      'actualDistanceM',
    ]);
    expect(
      zTrainingSessionCompletion.safeParse({ actualNotes: 'Bonnes jambes' })
        .success,
    ).toBe(true);
  });
});

describe('titreDeSeance', () => {
  it('nomme la Séance par son sport, et son intention quand elle en a une', () => {
    expect(titreDeSeance({ sport: 'RUN', plannedIntent: null })).toBe(
      'Course à pied',
    );
    expect(titreDeSeance({ sport: 'SWIM', plannedIntent: 'Technique' })).toBe(
      'Natation · Technique',
    );
  });
});
