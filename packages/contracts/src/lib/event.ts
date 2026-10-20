import * as z from 'zod';
import { zDay, zInstant, zPeriod } from './valeurs';

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

export const FREQUENCES = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const;

/** Les jours de la semaine, du lundi au dimanche, aux noms d'iCalendar. */
export const JOURS_DE_LA_SEMAINE = [
  'MO',
  'TU',
  'WE',
  'TH',
  'FR',
  'SA',
  'SU',
] as const;

export const zWeekday = /* @__PURE__ */ z.enum(JOURS_DE_LA_SEMAINE);

export type Weekday = z.infer<typeof zWeekday>;

/** Les fréquences qui acceptent des jours de la semaine. */
const AVEC_JOURS: readonly string[] = ['DAILY', 'WEEKLY'];

/**
 * La règle de récurrence d'un Événement, sur le modèle d'iCalendar et bornée à
 * ce qu'on en sert : une fréquence, un intervalle, des jours de la semaine, et
 * une fin par date **ou** par nombre. Les occurrences ne sont jamais
 * stockées : elles se calculent à la lecture, en heure de Paris.
 *
 * Les jours de la semaine choisissent les jours d'une semaine
 * (`WEEKLY`) ou filtrent les jours d'une série quotidienne (`DAILY`, « les
 * jours ouvrés »). Sur un mois ou une année, iCalendar leur donne un sens
 * (« tous les lundis du mois ») que personne ne demande : ils y sont refusés.
 *
 * `until` est le dernier jour civil où une occurrence peut commencer, inclus ;
 * `count` compte toutes les occurrences de la série, la première comprise, et
 * celles qu'une exception a supprimées aussi.
 */
export const zRecurrence = /* @__PURE__ */ z
  .object({
    freq: /* @__PURE__ */ z.enum(FREQUENCES),
    interval: /* @__PURE__ */ z.int().min(1),
    byWeekday: /* @__PURE__ */ z
      .array(zWeekday)
      .min(1)
      .refine((jours) => new Set(jours).size === jours.length, {
        error: 'Un jour de la semaine ne se nomme qu’une fois.',
      })
      .optional(),
    until: /* @__PURE__ */ zDay.optional(),
    count: /* @__PURE__ */ z.int().min(1).optional(),
  })
  .refine(({ until, count }) => until === undefined || count === undefined, {
    path: ['count'],
    error: 'Une récurrence finit par une date ou par un nombre, pas les deux.',
  })
  .refine(
    ({ freq, byWeekday }) =>
      byWeekday === undefined || AVEC_JOURS.includes(freq),
    {
      path: ['byWeekday'],
      error:
        'Les jours de la semaine ne valent que pour une récurrence quotidienne ou hebdomadaire.',
    },
  );

export type Recurrence = z.infer<typeof zRecurrence>;

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
  /** Vide pour un Événement qui n'a lieu qu'une fois. */
  recurrence: /* @__PURE__ */ zRecurrence.nullable(),
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
  recurrence: /* @__PURE__ */ zRecurrence.nullable().optional(),
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
 * L'occurrence visée par une action sur « cette occurrence » (AGENDA-2) :
 * son Événement, et l'instant où la règle la place, qui est son identité.
 */
export const zEventOccurrenceRef = /* @__PURE__ */ z.object({
  id: /* @__PURE__ */ z.string(),
  originalStart: zInstant,
});

export type EventOccurrenceRef = z.infer<typeof zEventOccurrenceRef>;

/**
 * Ce qu'on change d'une seule occurrence : son titre et ses bornes, les seuls
 * champs qu'une exception porte. Le reste appartient à la série. Un champ
 * absent garde la valeur de la série ; une occurrence déplacée sans fin
 * propre garde la durée des autres.
 */
export const zEventOccurrenceUpdate = /* @__PURE__ */ z.object({
  title: /* @__PURE__ */ z.string().trim().min(1).optional(),
  startsAt: /* @__PURE__ */ zInstant.optional(),
  endsAt: /* @__PURE__ */ zInstant.optional(),
});

export type EventOccurrenceUpdate = z.infer<typeof zEventOccurrenceUpdate>;

/**
 * Une occurrence d'un Événement, telle que la lecture d'une période la rend.
 * Un Événement sans récurrence n'en a qu'une ; une série en a autant que sa
 * règle en produit, moins celles qu'une exception supprime.
 *
 * Son identité est le couple (`eventId`, `originalStart`) : l'instant où la
 * règle la place, qui ne bouge pas quand une exception la déplace. Le titre et
 * les bornes sont ceux de l'occurrence, exception appliquée ; le reste est
 * celui de la série.
 */
export const zEventOccurrence = /* @__PURE__ */ z.object({
  eventId: /* @__PURE__ */ z.string(),
  originalStart: zInstant,
  isRecurring: /* @__PURE__ */ z.boolean(),
  title: /* @__PURE__ */ z.string(),
  startsAt: zInstant,
  endsAt: /* @__PURE__ */ zInstant.nullable(),
  category: zEventCategory,
  reminderLeadMinutes: /* @__PURE__ */ zReminderLeadMinutes.nullable(),
  recurrence: /* @__PURE__ */ zRecurrence.nullable(),
  scopeId: /* @__PURE__ */ z.string(),
});

export type EventOccurrence = z.infer<typeof zEventOccurrence>;

/**
 * Les Événements se lisent sur une période obligatoire : les occurrences qui
 * la rencontrent, et non celles qui y commencent (ADR 0030).
 */
export const zEventListQuery = zPeriod;

export type EventListQuery = z.infer<typeof zEventListQuery>;

/**
 * Une Échéance est un Événement portant la catégorie dédiée. La règle tient en
 * une ligne et vit ici seule, pour que l'API et le tableau de bord ne la
 * réécrivent pas chacun de leur côté.
 */
export function estEcheance(evenement: { category: EventCategory }): boolean {
  return evenement.category === CATEGORIE_ECHEANCE;
}
