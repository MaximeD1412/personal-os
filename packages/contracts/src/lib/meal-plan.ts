import * as z from 'zod';
import { zAllergen } from './ingredient';
import { zDay, zInstant, zWeek } from './valeurs';

/** Le moment d'un Repas planifié : le déjeuner ou le dîner. */
export const MOMENTS_DE_REPAS = ['LUNCH', 'DINNER'] as const;

export const zMealMoment = /* @__PURE__ */ z.enum(MOMENTS_DE_REPAS);

export type MealMoment = z.infer<typeof zMealMoment>;

export const LIBELLES_DES_MOMENTS: Readonly<Record<MealMoment, string>> = {
  LUNCH: 'Déjeuner',
  DINNER: 'Dîner',
};

/**
 * Un Planning de repas est ouvert tant qu'on le remplit, arrêté quand la
 * semaine est décidée. Arrêté, il refuse toute modification de ses repas ; il
 * se rouvre, sans jamais toucher une Liste de courses déjà tirée (ADR 0012).
 */
export const STATUTS_DE_PLANNING = ['OPEN', 'STOPPED'] as const;

export const zMealPlanStatus = /* @__PURE__ */ z.enum(STATUTS_DE_PLANNING);

export type MealPlanStatus = z.infer<typeof zMealPlanStatus>;

/**
 * La décision sur un Repas planifié. Un repas saisi à la main est approuvé
 * d'emblée ; seule la génération (CUISINE-15) propose, et un repas proposé
 * attend qu'on l'approuve ou le refuse.
 */
export const DECISIONS_DE_REPAS = ['APPROVED', 'PROPOSED', 'REFUSED'] as const;

export const zMealPlanEntryDecision =
  /* @__PURE__ */ z.enum(DECISIONS_DE_REPAS);

export type MealPlanEntryDecision = z.infer<typeof zMealPlanEntryDecision>;

export const LIBELLES_DES_DECISIONS: Readonly<
  Record<MealPlanEntryDecision, string>
> = {
  APPROVED: 'Approuvé',
  PROPOSED: 'Proposé',
  REFUSED: 'Refusé',
};

/** Les portions d'un repas : ses Participants, plus ses Invités. */
export function portions(repas: {
  participantIds: readonly string[];
  guestCount: number;
}): number {
  return repas.participantIds.length + repas.guestCount;
}

/**
 * Un Repas planifié : une Recette, ou un intitulé libre quand on ne cuisine
 * pas d'après une recette (des restes, un restaurant). Ses portions se
 * déduisent toujours de ses Participants et de ses Invités.
 */
export const zMealPlanEntry = /* @__PURE__ */ z.object({
  id: /* @__PURE__ */ z.string(),
  day: zDay,
  moment: zMealMoment,
  recipe: /* @__PURE__ */ z
    .object({ id: z.string(), title: z.string() })
    .nullable(),
  title: /* @__PURE__ */ z.string().nullable(),
  participantIds: /* @__PURE__ */ z.array(z.string()),
  guestCount: /* @__PURE__ */ z.int(),
  servings: /* @__PURE__ */ z.int(),
  decision: zMealPlanEntryDecision,
  createdAt: zInstant,
});

export type MealPlanEntry = z.infer<typeof zMealPlanEntry>;

/**
 * Un créneau d'un Tour de génération : un jour, un moment, et la tablée pour
 * qui l'IA propose un repas. Ses Participants sont des Comptes du Foyer.
 */
export const zGenerationSlot = /* @__PURE__ */ z.object({
  day: zDay,
  moment: zMealMoment,
  participantIds: /* @__PURE__ */ z.array(z.string()),
  guestCount: /* @__PURE__ */ z.int(),
});

export type GenerationSlot = z.infer<typeof zGenerationSlot>;

/**
 * Pourquoi le contrôle a vidé un créneau. Il ne présente jamais un repas qu'il
 * n'a pas pu vérifier (risque IA-1) :
 *
 * - `ALLERGEN` : un ingrédient porte un Allergène d'un Participant allergique ;
 * - `EXCLUDED_INGREDIENT` : un ingrédient est interdit à un Participant
 *   (allergie ou exclusion visant l'Ingrédient lui-même) ;
 * - `UNKNOWN_INGREDIENT` : un libellé que le résolveur ne rattache à aucun
 *   Ingrédient, la proposition n'est pas contrôlable ;
 * - `UNKNOWN_RECIPE` : la proposition cite une Recette que le Foyer n'a pas ;
 * - `NO_PROPOSAL` : l'IA n'a rien proposé pour ce créneau.
 */
export const RAISONS_DE_REJET = [
  'ALLERGEN',
  'EXCLUDED_INGREDIENT',
  'UNKNOWN_INGREDIENT',
  'UNKNOWN_RECIPE',
  'NO_PROPOSAL',
] as const;

export const zRejectionReason = /* @__PURE__ */ z.enum(RAISONS_DE_REJET);

export type RejectionReason = z.infer<typeof zRejectionReason>;

export const LIBELLES_DES_RAISONS_DE_REJET: Readonly<
  Record<RejectionReason, string>
> = {
  ALLERGEN: 'Contient un allergène',
  EXCLUDED_INGREDIENT: 'Contient un aliment exclu',
  UNKNOWN_INGREDIENT: 'Ingrédient inconnu',
  UNKNOWN_RECIPE: 'Recette inconnue',
  NO_PROPOSAL: 'Aucune proposition',
};

/**
 * Un créneau que le contrôle a vidé, et pourquoi. `ingredient` est
 * l'ingrédient en cause, sous le libellé proposé (ou celui de la Recette
 * citée), avec son Ingrédient s'il a été résolu ; `allergen`, l'Allergène en
 * cause ; `participantIds`, les Participants dont la Préférence l'a écarté.
 * Le tour suivant retente ce créneau.
 */
export const zRejectedSlot = /* @__PURE__ */ z.object({
  slot: zGenerationSlot,
  reason: zRejectionReason,
  ingredient: /* @__PURE__ */ z
    .object({
      label: /* @__PURE__ */ z.string(),
      ingredientId: /* @__PURE__ */ z.string().nullable(),
    })
    .nullable(),
  allergen: /* @__PURE__ */ zAllergen.nullable(),
  participantIds: /* @__PURE__ */ z.array(z.string()),
});

export type RejectedSlot = z.infer<typeof zRejectedSlot>;

/**
 * Un Tour de génération, tel que le planning le relit : son numéro, à partir
 * de 1, la Trace IA de son appel au modèle, et les créneaux que le contrôle a
 * vidés.
 */
export const zGenerationRoundSummary = /* @__PURE__ */ z.object({
  id: /* @__PURE__ */ z.string(),
  number: /* @__PURE__ */ z.int(),
  traceId: /* @__PURE__ */ z.string().nullable(),
  rejected: /* @__PURE__ */ z.array(zRejectedSlot),
  createdAt: zInstant,
});

export type GenerationRoundSummary = z.infer<typeof zGenerationRoundSummary>;

/**
 * Le Planning de repas d'une semaine, et ses repas par jour puis par moment.
 * Il y en a un par semaine et par Foyer.
 */
export const zMealPlan = /* @__PURE__ */ z.object({
  id: /* @__PURE__ */ z.string(),
  week: zWeek,
  status: zMealPlanStatus,
  entries: /* @__PURE__ */ z.array(zMealPlanEntry),
  /** Ses Tours de génération, dans leur ordre. */
  rounds: /* @__PURE__ */ z.array(zGenerationRoundSummary),
  createdAt: zInstant,
});

export type MealPlan = z.infer<typeof zMealPlan>;

const zId = /* @__PURE__ */ z.string().trim().min(1);

const zTitle = /* @__PURE__ */ z.string().trim().min(1).max(160);

/** Une tablée, pas une cantine. */
const zGuestCount = /* @__PURE__ */ z.int().min(0).max(50);

/**
 * Les Participants d'un repas : des Comptes du Foyer. Qu'il y en ait au moins
 * un, et que chacun soit du Foyer, sont des règles métier.
 */
const zParticipantIds = /* @__PURE__ */ z.array(zId).max(20);

const MESSAGE_DE_PLAT =
  'Un repas porte soit une recette, soit un intitulé : jamais les deux, ni aucun.';

/**
 * La saisie d'un Repas planifié, à plat pour que le formulaire se
 * préremplisse par son URL. Elle porte une recette ou un intitulé, et le
 * schéma refuse les deux comme aucun. Que le jour soit dans la semaine du
 * planning, que la recette existe et que les Participants soient du Foyer
 * sont des règles métier.
 */
export const zMealPlanEntryInput = /* @__PURE__ */ z
  .object({
    day: zDay,
    moment: zMealMoment,
    recipeId: /* @__PURE__ */ zId.optional(),
    title: /* @__PURE__ */ zTitle.optional(),
    participantIds: zParticipantIds,
    guestCount: /* @__PURE__ */ zGuestCount.default(0),
  })
  .refine(
    ({ recipeId, title }) => (recipeId === undefined) !== (title === undefined),
    { path: ['title'], error: MESSAGE_DE_PLAT },
  );

export type MealPlanEntryInput = z.infer<typeof zMealPlanEntryInput>;

/**
 * Une modification ne porte que ce qu'elle change. Une recette remplace
 * l'intitulé, un intitulé remplace la recette : les deux à la fois sont
 * refusés.
 */
export const zMealPlanEntryUpdate = /* @__PURE__ */ z
  .object({
    day: zDay,
    moment: zMealMoment,
    recipeId: zId,
    title: zTitle,
    participantIds: zParticipantIds,
    guestCount: zGuestCount,
  })
  .partial()
  .refine(
    ({ recipeId, title }) => recipeId === undefined || title === undefined,
    { path: ['title'], error: MESSAGE_DE_PLAT },
  );

export type MealPlanEntryUpdate = z.infer<typeof zMealPlanEntryUpdate>;

/** La lecture d'un Planning de repas : sa semaine, par son lundi. */
export const zMealPlanQuery = /* @__PURE__ */ z.object({ week: zWeek });

export type MealPlanQuery = z.infer<typeof zMealPlanQuery>;

/**
 * La décision sur un repas proposé : on l'approuve ou on le refuse. Qu'il soit
 * encore proposé est une règle métier.
 */
export const zMealPlanEntryDecisionInput = /* @__PURE__ */ z.object({
  decision: /* @__PURE__ */ zMealPlanEntryDecision.exclude(['PROPOSED']),
});

export type MealPlanEntryDecisionInput = z.infer<
  typeof zMealPlanEntryDecisionInput
>;

/**
 * Un Tour de génération qui vient d'être lancé, avec les Repas planifiés
 * qu'il propose : chacun attend qu'on l'approuve ou le refuse.
 */
export const zGenerationRound = /* @__PURE__ */ zGenerationRoundSummary.extend(
  { entries: /* @__PURE__ */ z.array(zMealPlanEntry) },
);

export type GenerationRound = z.infer<typeof zGenerationRound>;

/**
 * Un créneau à remplir au premier tour. Qu'il soit dans la semaine du
 * planning, et que ses Participants (au moins un) soient du Foyer, sont des
 * règles métier.
 */
export const zGenerationSlotInput = /* @__PURE__ */ z.object({
  day: zDay,
  moment: zMealMoment,
  participantIds: zParticipantIds,
  guestCount: /* @__PURE__ */ zGuestCount.default(0),
});

export type GenerationSlotInput = z.infer<typeof zGenerationSlotInput>;

/**
 * Le lancement d'un tour. Les créneaux ne comptent qu'au premier : les tours
 * suivants ne portent que sur les repas refusés et les créneaux que le
 * contrôle a vidés. Quatorze créneaux font une semaine.
 */
export const zGenerationRoundInput = /* @__PURE__ */ z.object({
  slots: /* @__PURE__ */ z.array(zGenerationSlotInput).max(14).default([]),
});

export type GenerationRoundInput = z.infer<typeof zGenerationRoundInput>;
