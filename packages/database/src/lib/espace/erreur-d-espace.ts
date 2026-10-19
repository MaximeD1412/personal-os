/** Pourquoi le mécanisme a refusé une opération. */
export type RaisonDuRefus =
  /** L'enregistrement écrit ne porte aucun Espace. C'est un défaut de module. */
  | 'absent'
  /** L'Espace visé n'est pas atteignable par le compte connecté. */
  | 'hors-portee'
  /** L'Espace visé existe pour ce compte, mais le module ne l'accepte pas. */
  | 'type-refuse'
  /** Aucune portée n'est ouverte : la requête n'a traversé aucun module. */
  | 'sans-portee'
  /**
   * Une écriture imbriquée atteint un modèle cloisonné par un geste que la
   * garde ne vérifie pas. C'est un défaut de module : ce geste se fait au
   * premier niveau, par le dépôt du modèle concerné.
   */
  | 'imbrication';

/** Refus opposé par la garde d'Espace, au niveau de l'accès aux données. */
export class ErreurDEspace extends Error {
  constructor(
    readonly raison: RaisonDuRefus,
    message: string,
  ) {
    super(message);
    this.name = 'ErreurDEspace';
  }
}
