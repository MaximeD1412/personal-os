/**
 * Où en est un objet daté, dit dans le seul vocabulaire que l'Agenda affiche.
 * Il couvre les cinq modules qui produisent des objets datés (ADR 0011) : un
 * Événement est toujours prévu, une Séance porte les trois (ADR 0022), un
 * Repas planifié devient réalisé quand il est cuisiné.
 */
export type AgendaItemStatus = 'PLANNED' | 'DONE' | 'MISSED';

/**
 * La référence à un objet daté telle qu'elle apparaît dans l'Agenda.
 *
 * Le contrat est **étroit**, et c'est la décision : source, identité
 * d'origine, période, intitulé, statut. Aucun attribut métier n'y transite —
 * ni catégorie, ni allure, ni portions, ni même l'Espace. L'Agenda affiche des
 * références, pas des objets (ADR 0011).
 */
export interface AgendaItem {
  /**
   * L'identifiant du module d'origine. C'est une chaîne libre et non une
   * union : un module nouveau s'annonce sans que les contrats partagés, ni
   * l'Agenda, aient à le connaître d'avance.
   */
  source: string;
  /** L'identité de l'objet **dans son module**, jamais celle d'une entrée. */
  sourceId: string;
  title: string;
  /** ISO-8601, comme tout ce qui traverse le réseau. */
  startsAt: string;
  /** Vide quand l'objet n'a pas de fin distincte de son début. */
  endsAt: string | null;
  status: AgendaItemStatus;
}

/** Les champs qu'une Entrée d'agenda porte, et les seuls. */
export const CHAMPS_D_ENTREE_D_AGENDA: readonly (keyof AgendaItem)[] = [
  'source',
  'sourceId',
  'title',
  'startsAt',
  'endsAt',
  'status',
];

/**
 * La période sur laquelle l'Agenda est demandé. Ses deux bornes sont
 * obligatoires : l'Agenda est une vue « pour une période donnée », et sans
 * bornes il grossirait sans fin.
 */
export interface AgendaPeriod {
  /** ISO-8601, borne incluse. */
  from: string;
  /** ISO-8601, borne incluse. */
  to: string;
}

/**
 * Le port par lequel un module se présente à l'Agenda. Chaque module
 * l'implémente et s'enregistre ; l'Agenda ne connaît aucun domaine, et en
 * ajouter un ne le modifie pas (ADR 0011).
 */
export interface AgendaContributor {
  /** L'identifiant du module, repris tel quel dans `AgendaItem.source`. */
  readonly source: string;

  /**
   * Les objets datés du module qui rencontrent la période. Le cloisonnement
   * par Espace n'est pas l'affaire du contributeur : il lit par les chemins
   * ordinaires, et la garde borne ses requêtes (ADR 0028).
   */
  lister(periode: AgendaPeriod): Promise<AgendaItem[]>;
}

/** La source du Calendrier, premier contributeur de l'Agenda. */
export const SOURCE_CALENDRIER = 'calendar';
