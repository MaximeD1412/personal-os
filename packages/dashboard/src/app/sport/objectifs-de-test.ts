import type { TrainingGoal } from '@personal-os/contracts';

/*
 * Des Objectifs pour les tests des écrans du Sport : un à venir avec des
 * Séances de chaque statut, un sans Séance, un passé.
 */

/** Le semi-marathon : 3 faites, 1 manquée, 2 à venir. */
export const SEMI: TrainingGoal = {
  id: 'objectif-semi',
  title: 'Semi-marathon de Lyon',
  date: '2099-06-07',
  intent: 'Passer sous 1 h 45',
  progress: { done: 3, missed: 1, planned: 2 },
  scopeId: 'espace-a',
  createdAt: '2026-10-01T08:00:00.000Z',
};

/** Un Objectif sans Séance ni intention. */
export const TRIATHLON: TrainingGoal = {
  ...SEMI,
  id: 'objectif-triathlon',
  title: 'Triathlon de Nice',
  date: '2099-09-20',
  intent: null,
  progress: { done: 0, missed: 0, planned: 0 },
};

/** Un Objectif dont la course est passée. */
export const PASSE: TrainingGoal = {
  ...SEMI,
  id: 'objectif-passe',
  title: '10 km de Paris',
  date: '2020-03-01',
  intent: null,
  progress: { done: 4, missed: 0, planned: 0 },
};
