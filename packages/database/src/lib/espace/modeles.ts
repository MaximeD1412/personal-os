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
    // Le catalogue d'Ingrédients est global : les deux Comptes du Foyer le
    // partagent (CUISINE-1).
    Ingredient: [],
    // Ses Alias le sont aussi : un libellé rattaché vaut pour le Foyer entier
    // (CUISINE-3).
    IngredientAlias: [],
    Scope: [
      'traces',
      'events',
      'eventExceptions',
      'aiTraces',
      'unresolvedCommands',
    ],
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
  Ingredient: [],
  IngredientAlias: [],
  Scope: [
    'household',
    'holder',
    'traces',
    'events',
    'eventExceptions',
    'aiTraces',
    'unresolvedCommands',
  ],
};

/** Le modèle qui porte les Espaces : une relation vers lui nomme un Espace. */
export const MODELE_ESPACE = 'Scope';

/**
 * Le modèle de données que Prisma embarque dans son client : la part du DMMF
 * qu'il garde pour l'exécution. Il nomme chaque champ, et pour une relation,
 * le modèle qu'elle vise.
 */
export interface ModeleDeDonnees {
  models: Readonly<
    Record<
      string,
      { fields: readonly { name: string; kind: string; type: string }[] }
    >
  >;
}

/** Ce que la garde sait du schéma. */
export interface SchemaDEspace {
  /** Pour chaque modèle, ses relations et le modèle que chacune vise. */
  relations: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /**
   * Les modèles hors Espace, et pour chacun ses relations vers une donnée
   * cloisonnée. Tout modèle absent d'ici est cloisonné.
   */
  horsEspace: Readonly<Record<string, readonly string[]>>;
}

/**
 * Les relations se lisent du schéma, à l'exécution, et non d'une liste tenue à
 * la main : un modèle nouveau, et ses lignes imbriquées, sont couverts sans que
 * personne y pense (ADR 0028).
 */
export function lireLeSchema(
  donnees: ModeleDeDonnees,
  horsEspace: SchemaDEspace['horsEspace'] = RELATIONS_VERS_ESPACE,
): SchemaDEspace {
  const relations = Object.fromEntries(
    Object.entries(donnees.models).map(([nom, { fields }]) => [
      nom,
      Object.fromEntries(
        fields
          .filter(({ kind }) => kind === 'object')
          .map(({ name, type }) => [name, type]),
      ),
    ]),
  );

  return { relations, horsEspace };
}

/**
 * Le client Prisma ne publie pas son modèle de données : il le garde sous un
 * nom interne. Mieux vaut refuser de démarrer que de garder sans le connaître.
 */
export function lireLeModeleDeDonnees(client: object): ModeleDeDonnees {
  const donnees = (client as { _runtimeDataModel?: ModeleDeDonnees })
    ._runtimeDataModel;
  if (!donnees?.models) {
    throw new Error(
      "Le client Prisma n'expose plus son modèle de données : la garde d'Espace ne peut pas lire les relations du schéma.",
    );
  }
  return donnees;
}

export function porteUnEspace(
  model: string | undefined,
  schema: SchemaDEspace,
): boolean {
  return model !== undefined && !(model in schema.horsEspace);
}

export function relationsVersEspace(
  model: string,
  schema: SchemaDEspace,
): readonly string[] {
  return schema.horsEspace[model] ?? [];
}

export function relationsDe(
  model: string,
  schema: SchemaDEspace,
): Readonly<Record<string, string>> {
  return schema.relations[model] ?? {};
}
