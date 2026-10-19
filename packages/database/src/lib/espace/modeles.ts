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
export const MODELES_HORS_ESPACE: Readonly<Record<string, readonly string[]>> =
  {
    HealthProbe: [],
    User: [],
    Session: [],
    LoginTransaction: [],
    Household: [],
    Scope: ['traces', 'events', 'eventExceptions'],
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
  User: ['household', 'personalScope', 'sessions'],
  Session: ['user'],
  LoginTransaction: [],
  Household: ['members', 'scopes'],
  Scope: ['household', 'holder', 'traces', 'events', 'eventExceptions'],
};

/**
 * Les relations entre deux modèles cloisonnés : un Événement et ses
 * exceptions.
 *
 * La garde vérifie l'Espace d'une charge écrite, pas celui des charges
 * qu'elle contiendrait (ADR 0028). Ces relations ne s'écrivent donc jamais par
 * un chemin imbriqué : chaque modèle s'écrit seul, par ses clés, et la garde
 * vérifie son Espace. Leur clé étrangère porte l'Espace des deux côtés, si
 * bien que la base refuse elle-même une exception rattachée à l'Événement
 * d'un autre Espace.
 *
 * `modeles.spec.ts` relit cette liste contre le schéma, et vérifie que chaque
 * clé porte bien `scopeId`.
 */
export const RELATIONS_CLOISONNEES: Readonly<
  Record<string, readonly string[]>
> = {
  Event: ['exceptions'],
  EventException: ['event'],
};

export function porteUnEspace(model: string | undefined): boolean {
  return model !== undefined && !(model in MODELES_HORS_ESPACE);
}

export function relationsVersEspace(model: string): readonly string[] {
  return RELATIONS_VERS_ESPACE[model] ?? [];
}

export function relationsCloisonnees(model: string): readonly string[] {
  return RELATIONS_CLOISONNEES[model] ?? [];
}
