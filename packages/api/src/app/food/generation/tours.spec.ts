import type { MealPlanEntryDecision } from '@personal-os/contracts';
import {
  appliquerDecision,
  creneauxDuTour,
  estArretable,
  peutLancerUnTour,
  type Creneau,
  type RepasDuTour,
} from './tours';

const LUNDI = '2028-03-13';
const MARDI = '2028-03-14';
const MERCREDI = '2028-03-15';

function repas(
  day: string,
  moment: RepasDuTour['moment'],
  decision: MealPlanEntryDecision,
  participantIds: string[] = ['a'],
): RepasDuTour {
  return { day, moment, decision, participantIds, guestCount: 0 };
}

function creneau(day: string, moment: Creneau['moment']): Creneau {
  return { day, moment, participantIds: ['a', 'b'], guestCount: 1 };
}

function ouvert(...entries: RepasDuTour[]) {
  return { status: 'OPEN' as const, entries };
}

describe('peutLancerUnTour', () => {
  it('refuse de relancer tant qu’un repas est proposé', () => {
    const planning = ouvert(
      repas(LUNDI, 'LUNCH', 'REFUSED'),
      repas(MARDI, 'LUNCH', 'PROPOSED'),
    );

    expect(peutLancerUnTour(planning, [])).toBe(false);
    expect(peutLancerUnTour(planning, [creneau(MERCREDI, 'LUNCH')])).toBe(
      false,
    );
  });

  it('relance quand chaque repas est statué et qu’un repas est refusé', () => {
    const planning = ouvert(
      repas(LUNDI, 'LUNCH', 'APPROVED'),
      repas(MARDI, 'LUNCH', 'REFUSED'),
    );

    expect(peutLancerUnTour(planning, [])).toBe(true);
  });

  it('lance le premier tour quand un créneau demandé est à remplir', () => {
    expect(peutLancerUnTour(ouvert(), [creneau(LUNDI, 'LUNCH')])).toBe(true);
  });

  it('ne lance rien quand il n’y a rien à remplir', () => {
    expect(peutLancerUnTour(ouvert(), [])).toBe(false);
    expect(
      peutLancerUnTour(ouvert(repas(LUNDI, 'LUNCH', 'APPROVED')), [
        creneau(LUNDI, 'LUNCH'),
      ]),
    ).toBe(false);
  });

  it('ne lance rien sur un planning arrêté', () => {
    expect(
      peutLancerUnTour(
        { status: 'STOPPED', entries: [repas(LUNDI, 'LUNCH', 'REFUSED')] },
        [creneau(MARDI, 'LUNCH')],
      ),
    ).toBe(false);
  });
});

describe('appliquerDecision', () => {
  it.each(['APPROVED', 'REFUSED'] as const)(
    'statue %s sur un repas proposé',
    (decision) => {
      expect(
        appliquerDecision(repas(LUNDI, 'LUNCH', 'PROPOSED'), decision),
      ).toEqual({ decision });
    },
  );

  it.each(['APPROVED', 'REFUSED'] as const)(
    'refuse de revenir sur un repas déjà %s',
    (dejaStatue) => {
      for (const decision of ['APPROVED', 'REFUSED'] as const) {
        expect(
          appliquerDecision(repas(LUNDI, 'LUNCH', dejaStatue), decision),
        ).toEqual({ echec: 'non_propose' });
      }
    },
  );
});

describe('estArretable', () => {
  it('arrête un planning dont chaque repas est approuvé', () => {
    expect(
      estArretable(
        ouvert(
          repas(LUNDI, 'LUNCH', 'APPROVED'),
          repas(MARDI, 'DINNER', 'APPROVED'),
        ),
      ),
    ).toBe(true);
  });

  it('arrête un planning dont les refusés restent, que l’arrêt retire', () => {
    expect(
      estArretable(
        ouvert(
          repas(LUNDI, 'LUNCH', 'APPROVED'),
          repas(MARDI, 'DINNER', 'REFUSED'),
        ),
      ),
    ).toBe(true);
  });

  it('n’arrête pas un planning dont un repas est encore proposé', () => {
    expect(
      estArretable(
        ouvert(
          repas(LUNDI, 'LUNCH', 'APPROVED'),
          repas(MARDI, 'DINNER', 'PROPOSED'),
        ),
      ),
    ).toBe(false);
  });

  it('n’arrête pas un planning déjà arrêté', () => {
    expect(estArretable({ status: 'STOPPED', entries: [] })).toBe(false);
  });
});

describe('creneauxDuTour', () => {
  it('ne porte, au tour suivant, que sur les créneaux des refusés', () => {
    const planning = ouvert(
      repas(LUNDI, 'LUNCH', 'APPROVED'),
      repas(LUNDI, 'DINNER', 'REFUSED', ['b']),
      repas(MARDI, 'DINNER', 'APPROVED'),
      repas(MERCREDI, 'LUNCH', 'REFUSED'),
    );

    expect(creneauxDuTour(planning, [])).toEqual([
      { day: LUNDI, moment: 'DINNER', participantIds: ['b'], guestCount: 0 },
      { day: MERCREDI, moment: 'LUNCH', participantIds: ['a'], guestCount: 0 },
    ]);
  });

  it('ajoute les créneaux demandés encore vides, dans l’ordre de la semaine', () => {
    const planning = ouvert(repas(MARDI, 'LUNCH', 'REFUSED'));

    expect(
      creneauxDuTour(planning, [
        creneau(MERCREDI, 'LUNCH'),
        creneau(LUNDI, 'DINNER'),
        creneau(LUNDI, 'LUNCH'),
      ]),
    ).toEqual([
      creneau(LUNDI, 'LUNCH'),
      creneau(LUNDI, 'DINNER'),
      { day: MARDI, moment: 'LUNCH', participantIds: ['a'], guestCount: 0 },
      creneau(MERCREDI, 'LUNCH'),
    ]);
  });

  it('ne redemande pas un créneau déjà occupé, ni deux fois le même', () => {
    const planning = ouvert(
      repas(LUNDI, 'LUNCH', 'APPROVED'),
      repas(LUNDI, 'DINNER', 'REFUSED'),
    );

    expect(
      creneauxDuTour(planning, [
        creneau(LUNDI, 'LUNCH'),
        creneau(LUNDI, 'DINNER'),
        creneau(MARDI, 'LUNCH'),
        creneau(MARDI, 'LUNCH'),
      ]),
    ).toEqual([
      { day: LUNDI, moment: 'DINNER', participantIds: ['a'], guestCount: 0 },
      creneau(MARDI, 'LUNCH'),
    ]);
  });
});
