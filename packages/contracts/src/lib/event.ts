/**
 * La catégorie d'un Événement. `DEADLINE` est la catégorie dédiée : un
 * Événement qui la porte **est** une Échéance. Il n'existe aucune entité
 * « échéance » (ADR 0017).
 */
export type EventCategory = 'APPOINTMENT' | 'BIRTHDAY' | 'DEADLINE' | 'OTHER';

export const EVENT_CATEGORIES: readonly EventCategory[] = [
  'APPOINTMENT',
  'BIRTHDAY',
  'DEADLINE',
  'OTHER',
];

/** La catégorie qui fait d'un Événement une Échéance. */
export const CATEGORIE_ECHEANCE: EventCategory = 'DEADLINE';

/**
 * Une entrée du Calendrier : le seul objet daté qui n'appartienne à aucun
 * autre module. Une Séance et un Repas planifié n'en sont pas.
 */
export interface Event {
  id: string;
  title: string;
  /** ISO-8601, comme tout ce qui traverse le réseau. */
  startsAt: string;
  /** Vide quand l'Événement n'a pas de fin distincte de son début. */
  endsAt: string | null;
  category: EventCategory;
  /**
   * Le délai de rappel, en minutes avant le début. Un « rappel » est un
   * délai, pas un objet : rien n'est planifié, rien n'est stocké en plus
   * (ADR 0017).
   */
  reminderLeadMinutes: number | null;
  scopeId: string;
  createdAt: string;
}

/**
 * Ce qu'une saisie porte. L'Espace est obligatoire à la création — le
 * Calendrier accepte les deux, c'est donc à la création qu'on choisit
 * (ADR 0014).
 */
export interface EventInput {
  title: string;
  startsAt: string;
  endsAt?: string | null;
  category: EventCategory;
  reminderLeadMinutes?: number | null;
  scopeId: string;
}

/**
 * Une modification n'a pas à répéter l'Espace : le filtre de la garde a déjà
 * borné l'Événement aux Espaces atteignables. Le nommer quand même, c'est
 * déplacer l'Événement — et cela se vérifie (ADR 0028).
 */
export type EventUpdate = Partial<EventInput>;

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
