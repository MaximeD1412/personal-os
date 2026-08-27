import { ErreurDEspace } from './erreur-d-espace';
import { porteUnEspace, relationsVersEspace } from './modeles';
import type { PorteeEspace } from './portee';

/** Une opération Prisma, telle que l'extension la présente. */
export interface OperationPrisma {
  model?: string;
  operation: string;
  args: Record<string, unknown>;
}

/** Les clés sous lesquelles une opération présente ce qu'elle écrit. */
const CHARGES_ECRITES = ['data', 'create', 'update'] as const;

/**
 * Les opérations dont le `data` crée des rangées. Une création doit nommer son
 * Espace ; une modification n'a pas à le répéter, puisque le filtre l'a déjà
 * bornée aux rangées atteignables — mais si elle le nomme, c'est qu'elle
 * déplace l'enregistrement, et cela se vérifie.
 */
const CREENT = new Set(['create', 'createMany', 'createManyAndReturn']);

/** Les opérations qui n'acceptent aucun filtre : leur ajouter un `where` échoue. */
const SANS_FILTRE = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'aggregateRaw',
  'findRaw',
]);

/**
 * Contient une opération dans la portée d'Espace de la requête. Renvoie les
 * arguments réécrits, ou lève si l'opération sort de la portée.
 */
export function cloisonner(
  operation: OperationPrisma,
  portee: PorteeEspace | null,
): Record<string, unknown> {
  if (!porteUnEspace(operation.model)) {
    return refuserLesCheminsImbriques(operation);
  }

  if (!portee) {
    throw new ErreurDEspace(
      'sans-portee',
      `Une requête sur ${operation.model} a été lancée hors de toute portée d'Espace.`,
    );
  }

  const args = { ...operation.args };

  for (const cle of CHARGES_ECRITES) {
    if (cle in args) {
      args[cle] = verifierEcriture(args[cle], portee, cree(operation, cle));
    }
  }

  if (!SANS_FILTRE.has(operation.operation)) {
    args['where'] = bornerAuxEspacesLisibles(args['where'], portee);
  }

  return args;
}

/**
 * Un modèle sans Espace n'a rien à filtrer, mais il ne doit pas servir de
 * chemin de traverse : une écriture imbriquée à travers lui atteindrait un
 * modèle cloisonné sans passer par la garde.
 */
function refuserLesCheminsImbriques(
  operation: OperationPrisma,
): Record<string, unknown> {
  const interdites = relationsVersEspace(operation.model ?? '');

  for (const cle of CHARGES_ECRITES) {
    const charge = operation.args[cle];
    if (!charge || typeof charge !== 'object') {
      continue;
    }

    for (const relation of interdites) {
      if (relation in charge) {
        throw new ErreurDEspace(
          'hors-portee',
          `Écrire « ${relation} » par un chemin imbriqué contournerait la garde d'Espace.`,
        );
      }
    }
  }

  return operation.args;
}

/** `upsert` porte les deux : sa clé `create` crée, sa clé `update` modifie. */
function cree(operation: OperationPrisma, cle: string): boolean {
  return cle === 'create' || (cle === 'data' && CREENT.has(operation.operation));
}

function verifierEcriture(
  data: unknown,
  portee: PorteeEspace,
  creation: boolean,
): unknown {
  if (Array.isArray(data)) {
    return data.map((rangee) => verifierEcriture(rangee, portee, creation));
  }
  if (!data || typeof data !== 'object') {
    return data;
  }

  const rangee = data as Record<string, unknown>;
  if (!('scopeId' in rangee)) {
    if (creation) {
      throw new ErreurDEspace(
        'absent',
        "L'enregistrement créé ne porte aucun Espace.",
      );
    }
    return rangee;
  }

  verifierEspaceVise(rangee['scopeId'], portee);
  return rangee;
}

function verifierEspaceVise(scopeId: unknown, portee: PorteeEspace): void {
  const espace = portee.espaces.find((candidat) => candidat.id === scopeId);
  if (!espace) {
    throw new ErreurDEspace(
      'hors-portee',
      `L'Espace ${String(scopeId)} est hors de portée de ce compte.`,
    );
  }

  if (!portee.typesAcceptes.includes(espace.kind)) {
    throw new ErreurDEspace(
      'type-refuse',
      `Ce module n'accepte pas l'Espace ${espace.kind}.`,
    );
  }
}

/**
 * Ajoute le filtre par Espace au filtre du module, sans le remplacer. Le nôtre
 * passe par `AND` : les champs uniques restent à la racine, et `findUnique`,
 * `update` et `delete` continuent donc de fonctionner. Deviner un identifiant
 * ne rapporte rien, puisque le filtre s'ajoute quand même.
 */
function bornerAuxEspacesLisibles(
  where: unknown,
  portee: PorteeEspace,
): Record<string, unknown> {
  const lisibles = portee.espaces
    .filter((espace) => portee.typesAcceptes.includes(espace.kind))
    .map((espace) => espace.id);

  const filtre =
    where && typeof where === 'object' ? (where as Record<string, unknown>) : {};
  const et = filtre['AND'];

  return {
    ...filtre,
    AND: [
      ...(Array.isArray(et) ? et : et === undefined ? [] : [et]),
      { scopeId: { in: lisibles } },
    ],
  };
}
