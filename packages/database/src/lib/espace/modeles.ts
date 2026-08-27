/**
 * Les modèles qui ne portent pas d'Espace, et pour chacun, les relations par
 * lesquelles on atteindrait un modèle qui en porte un.
 *
 * Tout modèle absent de cette liste est **cloisonné** : la garde s'applique à
 * lui sans que personne n'ait rien à déclarer. C'est le même raisonnement que
 * l'API fermée par défaut (ADR 0026) — un module nouveau est protégé parce
 * qu'il n'a rien à faire pour l'être.
 *
 * `modeles-cloisonnes.spec.ts` compare cette liste au schéma : y ajouter un
 * modèle est un geste délibéré, l'oublier fait échouer la campagne de test.
 */
export const MODELES_HORS_ESPACE: Readonly<Record<string, readonly string[]>> = {
  HealthProbe: [],
  User: [],
  Session: [],
  LoginTransaction: [],
  Household: [],
  HouseholdMember: [],
  Scope: ['traces'],
};

/**
 * Relations d'un modèle hors Espace qui peuvent, directement ou à travers
 * d'autres relations hors Espace, atteindre une donnée cloisonnée.
 *
 * Une charge imbriquée ne traverse pas l'extension Prisma pour chaque modèle
 * rencontré. Ces relations sont donc toutes refusées, y compris quand le
 * premier modèle n'est pas lui-même cloisonné. La liste est volontairement
 * explicite et est vérifiée contre le graphe du schéma par le test structurel.
 */
export const RELATIONS_VERS_ESPACE: Readonly<
  Record<string, readonly string[]>
> = {
  HealthProbe: [],
  User: ['household', 'memberships', 'personalScope', 'sessions'],
  Session: ['user'],
  LoginTransaction: [],
  Household: ['legacyUsers', 'members', 'scopes'],
  HouseholdMember: ['household', 'user'],
  Scope: ['household', 'holder', 'traces'],
};

export function porteUnEspace(model: string | undefined): boolean {
  return model !== undefined && !(model in MODELES_HORS_ESPACE);
}

export function relationsVersEspace(model: string): readonly string[] {
  return RELATIONS_VERS_ESPACE[model] ?? [];
}
