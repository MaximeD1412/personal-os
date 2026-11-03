import type { TrainingSessionCreateManyInput } from '../generated/prisma/models';

/*
 * Le jeu de démo du Sport : une semaine de Séances pour un Compte, dans son
 * Espace personnel. Elle montre chaque statut (ADR 0022) : des Séances
 * réalisées contre leur prévu, une Séance manquée qui garde le sien, une sortie
 * non planifiée, née réalisée sans prévu, et des Séances encore prévues.
 *
 * Les données sont déterministes et relatives à la semaine donnée, jamais à des
 * dates en dur. Le branchement dans le semis (`semer`, la liste des semeurs,
 * la commande `pnpm demo:seed`) vient avec INFRA-6 (#85).
 */

const HEURE_MS = 3_600_000;
const JOUR_MS = 24 * HEURE_MS;

type SeanceDeDemo = Omit<
  TrainingSessionCreateManyInput,
  'scopeId' | 'startsAt'
>;

/** Le jour (0 : lundi) et l'heure (après minuit) de chaque Séance. */
const SEMAINE: { jour: number; heure: number; seance: SeanceDeDemo }[] = [
  {
    jour: 0,
    heure: 7.25,
    seance: {
      sport: 'RUN',
      status: 'DONE',
      plannedDistanceM: 10_000,
      plannedDurationS: 3_600,
      plannedIntent: 'Footing',
      actualDistanceM: 11_200,
      actualDurationS: 3_840,
      actualNotes: 'Bonnes jambes',
    },
  },
  {
    jour: 1,
    heure: 18.5,
    seance: {
      sport: 'SWIM',
      status: 'MISSED',
      plannedDistanceM: 1_500,
      plannedDurationS: 1_800,
    },
  },
  {
    jour: 2,
    heure: 12.5,
    seance: {
      sport: 'STRENGTH',
      status: 'DONE',
      plannedDurationS: 2_700,
      plannedIntent: 'Gainage',
      actualDurationS: 2_400,
    },
  },
  {
    jour: 3,
    heure: 19,
    seance: {
      sport: 'BIKE',
      status: 'DONE',
      actualDistanceM: 32_000,
      actualDurationS: 4_500,
      actualNotes: 'Sortie imprévue avec le club',
    },
  },
  {
    jour: 5,
    heure: 9,
    seance: {
      sport: 'RUN',
      status: 'PLANNED',
      plannedDistanceM: 18_000,
      plannedDurationS: 6_300,
      plannedIntent: 'Sortie longue',
    },
  },
  {
    jour: 6,
    heure: 10,
    seance: {
      sport: 'OTHER',
      status: 'PLANNED',
      plannedDurationS: 3_600,
      plannedIntent: 'Randonnée',
    },
  },
];

/**
 * Les Séances de la semaine qui commence à `lundi` (minuit à Paris), dans
 * l'Espace personnel `scopeId`.
 */
export function seancesDeLaSemaine(
  lundi: Date,
  scopeId: string,
): TrainingSessionCreateManyInput[] {
  return SEMAINE.map(({ jour, heure, seance }) => ({
    ...seance,
    startsAt: new Date(lundi.getTime() + jour * JOUR_MS + heure * HEURE_MS),
    scopeId,
  }));
}
