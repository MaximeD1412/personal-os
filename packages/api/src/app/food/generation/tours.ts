/*
 * La machine à Tours de génération, sans base ni IA : (Planning, décisions) →
 * état suivant. L'IA propose, on statue sur chacun des repas proposés, puis on
 * relance : le tour suivant ne régénère que les refusés. On ne régénère jamais
 * un repas isolé au fil de l'eau.
 */
import type {
  MealMoment,
  MealPlanEntryDecision,
  MealPlanStatus,
} from '@personal-os/contracts';

/**
 * Un créneau à remplir : un jour, un moment, et la tablée pour qui l'IA
 * propose un repas.
 */
export interface Creneau {
  day: string;
  moment: MealMoment;
  participantIds: readonly string[];
  guestCount: number;
}

/** Ce que la machine lit d'un Repas planifié. */
export interface RepasDuTour extends Creneau {
  decision: MealPlanEntryDecision;
}

/** Ce que la machine lit d'un Planning de repas. */
export interface PlanningDuTour {
  status: MealPlanStatus;
  entries: readonly RepasDuTour[];
}

/** Ce qu'on peut décider d'un repas proposé. */
export type DecisionSurUnRepas = Exclude<MealPlanEntryDecision, 'PROPOSED'>;

/** `non_propose` : le repas est déjà approuvé ou refusé, il ne se redécide pas. */
export type Decision =
  | { decision: DecisionSurUnRepas }
  | { echec: 'non_propose' };

/**
 * Un tour se lance sur un planning ouvert dont chaque repas est statué, et
 * qui a quelque chose à remplir : un refusé à remplacer, ou un créneau
 * demandé encore vide.
 */
export function peutLancerUnTour(
  planning: PlanningDuTour,
  creneauxDemandes: readonly Creneau[],
): boolean {
  return (
    planning.status === 'OPEN' &&
    !aUnRepasPropose(planning) &&
    creneauxDuTour(planning, creneauxDemandes).length > 0
  );
}

/**
 * Les créneaux d'un tour : celui de chaque repas refusé, que le tour remplace,
 * pour la même tablée ; puis les créneaux demandés où rien n'est encore
 * planifié. Un repas approuvé ou proposé n'est jamais régénéré. Le tout dans
 * l'ordre de la semaine.
 */
export function creneauxDuTour(
  planning: PlanningDuTour,
  creneauxDemandes: readonly Creneau[],
): Creneau[] {
  const refuses = planning.entries
    .filter(({ decision }) => decision === 'REFUSED')
    .map(({ day, moment, participantIds, guestCount }) => ({
      day,
      moment,
      participantIds,
      guestCount,
    }));

  const occupes = new Set(planning.entries.map(cle));
  const vides = creneauxDemandes.filter((creneau) => {
    if (occupes.has(cle(creneau))) return false;
    occupes.add(cle(creneau));
    return true;
  });

  return [...refuses, ...vides].sort(dansLOrdreDeLaSemaine);
}

const RANG_DU_MOMENT: Readonly<Record<MealMoment, number>> = {
  LUNCH: 0,
  DINNER: 1,
};

function cle({ day, moment }: Pick<Creneau, 'day' | 'moment'>): string {
  return `${day} ${moment}`;
}

/** Par jour, le déjeuner avant le dîner. */
function dansLOrdreDeLaSemaine(a: Creneau, b: Creneau): number {
  return (
    a.day.localeCompare(b.day) ||
    RANG_DU_MOMENT[a.moment] - RANG_DU_MOMENT[b.moment]
  );
}

/** Seul un repas proposé se décide : on ne revient pas sur une décision. */
export function appliquerDecision(
  repas: Pick<RepasDuTour, 'decision'>,
  decision: DecisionSurUnRepas,
): Decision {
  return repas.decision === 'PROPOSED'
    ? { decision }
    : { echec: 'non_propose' };
}

/**
 * Un planning ouvert s'arrête quand plus aucun repas n'attend de décision.
 * Les refusés ne le retiennent pas : l'arrêt les retire.
 */
export function estArretable(planning: PlanningDuTour): boolean {
  return planning.status === 'OPEN' && !aUnRepasPropose(planning);
}

function aUnRepasPropose({ entries }: PlanningDuTour): boolean {
  return entries.some(({ decision }) => decision === 'PROPOSED');
}
