import { ErreurMetier } from '../erreurs/erreur-metier';
import { completer, manquer, modifier, type EtatDeSeance } from './seance';

const PREVUE: EtatDeSeance = {
  status: 'PLANNED',
  plannedDistanceM: 10_000,
  plannedDurationS: 3_600,
  plannedIntent: 'Footing',
  actualDistanceM: null,
  actualDurationS: null,
  actualNotes: null,
};

const REALISEE: EtatDeSeance = {
  ...PREVUE,
  status: 'DONE',
  actualDistanceM: 10_400,
  actualDurationS: 3_500,
};

const MANQUEE: EtatDeSeance = { ...PREVUE, status: 'MISSED' };

function codeDe(geste: () => unknown): string | undefined {
  try {
    geste();
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) {
      return erreur.code;
    }
    throw erreur;
  }
  return undefined;
}

describe('Séance', () => {
  describe('marquée réalisée', () => {
    it('garde son prévu et prend le réalisé déclaré', () => {
      expect(completer(PREVUE, { actualDurationS: 3_480 })).toEqual({
        status: 'DONE',
        actualDistanceM: null,
        actualDurationS: 3_480,
        actualNotes: null,
      });
    });

    it.each([
      ['déjà réalisée', REALISEE, 'training.already_done'],
      ['manquée', MANQUEE, 'training.already_missed'],
    ])('est refusée quand elle est %s', (_cas, seance, code) => {
      expect(codeDe(() => completer(seance, { actualNotes: 'Fait' }))).toBe(
        code,
      );
    });
  });

  describe('marquée manquée', () => {
    it('change de statut et rien d’autre : le prévu reste', () => {
      expect(manquer(PREVUE)).toEqual({ status: 'MISSED' });
    });

    it.each([
      ['déjà réalisée', REALISEE, 'training.already_done'],
      ['déjà manquée', MANQUEE, 'training.already_missed'],
    ])('est refusée quand elle est %s', (_cas, seance, code) => {
      expect(codeDe(() => manquer(seance))).toBe(code);
    });
  });

  describe('modifiée', () => {
    it('rend les seuls champs changés', () => {
      expect(modifier(PREVUE, { plannedDistanceM: 12_000 })).toEqual({
        plannedDistanceM: 12_000,
      });
    });

    it('accepte une correction du réalisé sur une Séance réalisée', () => {
      expect(modifier(REALISEE, { actualNotes: 'Vent de face' })).toEqual({
        actualNotes: 'Vent de face',
      });
    });

    it('refuse une modification vide', () => {
      expect(codeDe(() => modifier(PREVUE, {}))).toBe('training.empty_update');
    });

    it.each([
      ['prévue', PREVUE],
      ['manquée', MANQUEE],
    ])(
      'refuse un réalisé sur une Séance %s : il passe par « réalisée »',
      (_cas, seance) => {
        expect(codeDe(() => modifier(seance, { actualDurationS: 3_000 }))).toBe(
          'training.actual_requires_done',
        );
      },
    );

    it('refuse de retirer tout le prévu d’une Séance prévue', () => {
      expect(
        codeDe(() =>
          modifier(PREVUE, {
            plannedDistanceM: null,
            plannedDurationS: null,
            plannedIntent: null,
          }),
        ),
      ).toBe('training.planned_required');
    });

    it('refuse de retirer tout le réalisé d’une Séance réalisée', () => {
      expect(
        codeDe(() =>
          modifier(REALISEE, { actualDistanceM: null, actualDurationS: null }),
        ),
      ).toBe('training.actual_required');
    });
  });
});
