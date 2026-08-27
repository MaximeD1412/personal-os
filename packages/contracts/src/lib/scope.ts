/** Le type d'un Espace : celui d'une personne, ou celui du Foyer. */
export type ScopeKind = 'PERSONAL' | 'HOUSEHOLD';

/** Un Espace tel que le compte connecté peut l'atteindre. */
export interface Scope {
  id: string;
  kind: ScopeKind;
  label: string;
}
