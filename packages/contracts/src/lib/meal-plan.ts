import * as z from 'zod';
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
 * Le Planning de repas d'une semaine, et ses repas par jour puis par moment.
 * Il y en a un par semaine et par Foyer.
 */
export const zMealPlan = /* @__PURE__ */ z.object({
  id: /* @__PURE__ */ z.string(),
  week: zWeek,
  status: zMealPlanStatus,
  entries: /* @__PURE__ */ z.array(zMealPlanEntry),
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
