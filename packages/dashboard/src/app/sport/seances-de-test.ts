import type { TrainingSession } from '@personal-os/contracts';

/*
 * Des Séances de la semaine du lundi 19 octobre 2026, pour les tests des
 * écrans du Sport : une de chaque statut, et une sortie non planifiée.
 */

const SEANCE: TrainingSession = {
  id: 'seance',
  startsAt: '2026-10-20T05:15:00.000Z',
  sport: 'RUN',
  status: 'PLANNED',
  plannedDistanceM: null,
  plannedDurationS: null,
  plannedIntent: null,
  actualDistanceM: null,
  actualDurationS: null,
  actualNotes: null,
  goalId: null,
  scopeId: 'espace-a',
  createdAt: '2026-10-18T18:00:00.000Z',
};

/** Prévue : 10 km en 1 h, mardi 20 à 07:15. */
export const PREVUE: TrainingSession = {
  ...SEANCE,
  id: 'seance-prevue',
  plannedDistanceM: 10_000,
  plannedDurationS: 3_600,
  plannedIntent: 'Footing',
};

/** Réalisée : 11,2 km en 1 h 04, contre 10 km en 1 h de prévu. */
export const REALISEE: TrainingSession = {
  ...PREVUE,
  id: 'seance-realisee',
  startsAt: '2026-10-21T05:15:00.000Z',
  status: 'DONE',
  actualDistanceM: 11_200,
  actualDurationS: 3_840,
  actualNotes: 'Bonnes jambes',
};

/** Manquée : le prévu reste, sans réalisé. */
export const MANQUEE: TrainingSession = {
  ...PREVUE,
  id: 'seance-manquee',
  startsAt: '2026-10-22T16:30:00.000Z',
  sport: 'SWIM',
  status: 'MISSED',
  plannedDistanceM: 1_500,
  plannedDurationS: 1_800,
  plannedIntent: null,
};

/** Une sortie non planifiée : née réalisée, sans prévu. */
export const NON_PLANIFIEE: TrainingSession = {
  ...SEANCE,
  id: 'seance-non-planifiee',
  startsAt: '2026-10-24T08:00:00.000Z',
  sport: 'BIKE',
  status: 'DONE',
  actualDistanceM: 32_000,
  actualDurationS: 4_500,
};
