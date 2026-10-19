import * as z from 'zod';
import { zInstant, zPeriod } from './valeurs';

export const EVENT_CATEGORIES = [
  'APPOINTMENT',
  'BIRTHDAY',
  'DEADLINE',
  'OTHER',
] as const;

/**
 * La catégorie d'un Événement. `DEADLINE` est la catégorie dédiée : un
 * Événement qui la porte **est** une Échéance. Il n'existe aucune entité
 * « échéance » (ADR 0017).
 */
export const zEventCategory = /* @__PURE__ */ z.enum(EVENT_CATEGORIES);

export type EventCategory = z.infer<typeof zEventCategory>;

/** La catégorie qui fait d'un Événement une Échéance. */
export const CATEGORIE_ECHEANCE: EventCategory = 'DEADLINE';

/**
 * Le délai de rappel, en minutes avant le début. Un « rappel » est un délai,
 * pas un objet : rien n'est planifié, rien n'est stocké en plus (ADR 0017). Il
 * ne suit jamais l'Événement, d'où le minimum à zéro.
 */
const zReminderLeadMinutes = /* @__PURE__ */ z.int().min(0);

/**
 * Une entrée du Calendrier : le seul objet daté qui n'appartienne à aucun
 * autre module. Une Séance et un Repas planifié n'en sont pas.
 */
export const zEvent = /* @__PURE__ */ z.object({
  id: /* @__PURE__ */ z.string(),
  title: /* @__PURE__ */ z.string(),
  startsAt: zInstant,
  /** Vide quand l'Événement n'a pas de fin distincte de son début. */
  endsAt: /* @__PURE__ */ zInstant.nullable(),
  category: zEventCategory,
  reminderLeadMinutes: /* @__PURE__ */ zReminderLeadMinutes.nullable(),
  scopeId: /* @__PURE__ */ z.string(),
  createdAt: zInstant,
});

export type Event = z.infer<typeof zEvent>;

/**
 * Ce qu'une saisie porte. L'Espace est obligatoire à la création — le
 * Calendrier accepte les deux, c'est donc à la création qu'on choisit
 * (ADR 0014).
 *
 * Qu'une fin ne précède pas le début n'est pas une question de forme : une
 * modification peut n'en porter qu'une borne, et l'autre est en base. C'est
 * une règle métier, que le service juge (`event.period_reversed`).
 */
export const zEventInput = /* @__PURE__ */ z.object({
  title: /* @__PURE__ */ z.string().trim().min(1),
  startsAt: zInstant,
  endsAt: /* @__PURE__ */ zInstant.nullable().optional(),
  category: zEventCategory,
  reminderLeadMinutes: /* @__PURE__ */ zReminderLeadMinutes
    .nullable()
    .optional(),
  scopeId: /* @__PURE__ */ z.string().trim().min(1),
});

export type EventInput = z.infer<typeof zEventInput>;

/**
 * Une modification ne porte que ce qu'elle change, et un Événement n'a aucun
 * statut à y glisser (ADR 0030). Elle n'a pas à répéter l'Espace : le filtre
 * de la garde a déjà borné l'Événement aux Espaces atteignables. Le nommer
 * quand même, c'est déplacer l'Événement — et cela se vérifie (ADR 0028).
 */
export const zEventUpdate = /* @__PURE__ */ zEventInput.partial();

export type EventUpdate = z.infer<typeof zEventUpdate>;

/**
 * Les Événements se lisent sur une période obligatoire : ceux qui la
 * rencontrent, et non ceux qui y commencent (ADR 0030).
 */
export const zEventListQuery = zPeriod;

export type EventListQuery = z.infer<typeof zEventListQuery>;

/**
 * Une Échéance est un Événement portant la catégorie dédiée. La règle tient en
 * une ligne et vit ici seule, pour que l'API et le tableau de bord ne la
 * réécrivent pas chacun de leur côté.
 */
export function estEcheance(evenement: {
  category: EventCategory;
}): boolean {
  return evenement.category === CATEGORIE_ECHEANCE;
}
