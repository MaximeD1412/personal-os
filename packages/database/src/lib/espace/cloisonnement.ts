import { ErreurDEspace } from './erreur-d-espace';
import {
  MODELE_ESPACE,
  porteUnEspace,
  relationsDe,
  relationsVersEspace,
  type SchemaDEspace,
} from './modeles';
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
 * Les gestes imbriqués qui ne font que rattacher un modèle hors Espace, sans
 * rien y écrire : un Ingrédient du catalogue, par exemple.
 */
const RATTACHEMENTS = new Set(['connect', 'disconnect', 'set']);

/**
 * Contient une opération dans la portée d'Espace de la requête. Renvoie les
 * arguments réécrits, ou lève si l'opération sort de la portée.
 */
export function cloisonner(
  operation: OperationPrisma,
  portee: PorteeEspace | null,
  schema: SchemaDEspace,
): Record<string, unknown> {
  if (!porteUnEspace(operation.model, schema)) {
    return refuserLesCheminsImbriques(operation, schema);
  }

  if (!portee) {
    throw new ErreurDEspace(
      'sans-portee',
      `Une requête sur ${operation.model} a été lancée hors de toute portée d'Espace.`,
    );
  }

  const args = { ...operation.args };
  const model = operation.model ?? '';

  for (const cle of CHARGES_ECRITES) {
    if (cle in args) {
      verifierEcriture(model, args[cle], {
        portee,
        schema,
        creation: cree(operation, cle),
      });
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
  schema: SchemaDEspace,
): Record<string, unknown> {
  const interdites = relationsVersEspace(operation.model ?? '', schema);

  for (const cle of CHARGES_ECRITES) {
    const charge = operation.args[cle];
    if (!charge || typeof charge !== 'object') {
      continue;
    }

    for (const relation of interdites) {
      if (relation in charge) {
        throw new ErreurDEspace(
          'imbrication',
          `Écrire « ${relation} » par un chemin imbriqué contournerait la garde d'Espace.`,
        );
      }
    }
  }

  return operation.args;
}

/** `upsert` porte les deux : sa clé `create` crée, sa clé `update` modifie. */
function cree(operation: OperationPrisma, cle: string): boolean {
  return (
    cle === 'create' || (cle === 'data' && CREENT.has(operation.operation))
  );
}

interface Contexte {
  portee: PorteeEspace;
  schema: SchemaDEspace;
  creation: boolean;
}

/** Vérifie l'Espace de chaque rangée écrite au premier niveau, puis ses lignes. */
function verifierEcriture(
  model: string,
  data: unknown,
  contexte: Contexte,
): void {
  for (const rangee of rangees(data)) {
    const espace = espaceNomme(model, rangee, contexte.schema);
    if (espace === undefined) {
      if (contexte.creation) {
        throw new ErreurDEspace(
          'absent',
          "L'enregistrement créé ne porte aucun Espace.",
        );
      }
    } else {
      verifierEspaceVise(espace, contexte.portee);
    }

    verifierLesLignes(model, rangee, espace, contexte);
  }
}

/**
 * Une écriture imbriquée ne traverse pas l'extension pour chaque modèle
 * qu'elle atteint : la garde la suit donc elle-même, à toute profondeur, le
 * long des relations que le schéma déclare.
 *
 * Vers un modèle cloisonné, seule la création passe. La ligne créée est dans
 * l'Espace de son parent : la clé étrangère qui les relie porte `scopeId`
 * (`modeles.spec.ts`), si bien que Prisma le tire du parent et que la base
 * refuse tout écart. Une ligne qui nomme un autre Espace est refusée ici, avant
 * même d'atteindre la base. Tout autre geste — rattacher, modifier, supprimer —
 * se fait au premier niveau, par le dépôt du modèle concerné.
 *
 * Vers un modèle hors Espace, on rattache sans rien écrire.
 */
function verifierLesLignes(
  model: string,
  rangee: Record<string, unknown>,
  espace: unknown,
  contexte: Contexte,
): void {
  for (const [relation, cible] of Object.entries(
    relationsDe(model, contexte.schema),
  )) {
    const gestes = rangee[relation];
    if (cible === MODELE_ESPACE || !estUnObjet(gestes)) {
      continue;
    }

    for (const [geste, charge] of Object.entries(gestes)) {
      if (!porteUnEspace(cible, contexte.schema)) {
        if (!RATTACHEMENTS.has(geste)) {
          throw refusDImbrication(relation, geste);
        }
        continue;
      }

      if (geste !== 'create' && geste !== 'createMany') {
        throw refusDImbrication(relation, geste);
      }

      const lignes =
        geste === 'create'
          ? charge
          : estUnObjet(charge)
            ? charge['data']
            : undefined;
      for (const ligne of rangees(lignes)) {
        const sien = verifierLigne(cible, ligne, espace, contexte);
        verifierLesLignes(cible, ligne, sien, contexte);
      }
    }
  }
}

/** Une ligne n'a qu'un Espace : celui de son parent. */
function verifierLigne(
  model: string,
  ligne: Record<string, unknown>,
  espaceDuParent: unknown,
  contexte: Contexte,
): unknown {
  const sien = espaceNomme(model, ligne, contexte.schema);
  if (sien === undefined) {
    return espaceDuParent;
  }

  if (espaceDuParent === undefined) {
    // Le parent est modifié sans nommer son Espace : la garde ne connaît pas
    // le sien, et ne peut donc pas vérifier que la ligne est dans le même.
    // Une ligne qui en nomme un pourrait déplacer son parent : créée du côté
    // que vise sa clé étrangère, elle lui imposerait son `scopeId`.
    throw new ErreurDEspace(
      'imbrication',
      `Une ligne imbriquée de ${model} nomme un Espace sous une modification qui ne nomme pas celui de son parent.`,
    );
  }
  if (sien !== espaceDuParent) {
    throw new ErreurDEspace(
      'imbrication',
      `Une ligne imbriquée de ${model} nomme l'Espace ${String(sien)}, qui n'est pas celui de son parent.`,
    );
  }
  return sien;
}

/**
 * L'Espace qu'une rangée nomme : par sa clé `scopeId`, ou par sa relation à
 * l'Espace. Cette relation ne peut que rattacher un Espace par son
 * identifiant ; la créer ou la modifier d'ici échapperait à la garde.
 */
function espaceNomme(
  model: string,
  rangee: Record<string, unknown>,
  schema: SchemaDEspace,
): unknown {
  let espace = rangee['scopeId'];

  for (const [relation, cible] of Object.entries(relationsDe(model, schema))) {
    if (cible !== MODELE_ESPACE || !(relation in rangee)) {
      continue;
    }

    const gestes = rangee[relation];
    const connect = estUnObjet(gestes) ? gestes['connect'] : undefined;
    if (
      !estUnObjet(gestes) ||
      Object.keys(gestes).length !== 1 ||
      !estUnObjet(connect) ||
      Object.keys(connect).length !== 1 ||
      typeof connect['id'] !== 'string'
    ) {
      throw refusDImbrication(relation, Object.keys(gestes ?? {}).join(', '));
    }
    if (espace !== undefined && espace !== connect['id']) {
      throw new ErreurDEspace(
        'imbrication',
        `Une rangée de ${model} nomme deux Espaces à la fois.`,
      );
    }
    espace = connect['id'];
  }

  return espace;
}

function refusDImbrication(relation: string, geste: string): ErreurDEspace {
  return new ErreurDEspace(
    'imbrication',
    `« ${geste} » imbriqué sur « ${relation} » échapperait à la garde d'Espace : il se fait au premier niveau, par le dépôt du modèle concerné.`,
  );
}

function rangees(charge: unknown): Record<string, unknown>[] {
  return (Array.isArray(charge) ? charge : [charge]).filter(estUnObjet);
}

function estUnObjet(valeur: unknown): valeur is Record<string, unknown> {
  return !!valeur && typeof valeur === 'object' && !Array.isArray(valeur);
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
    where && typeof where === 'object'
      ? (where as Record<string, unknown>)
      : {};
  const et = filtre['AND'];

  return {
    ...filtre,
    AND: [
      ...(Array.isArray(et) ? et : et === undefined ? [] : [et]),
      { scopeId: { in: lisibles } },
    ],
  };
}
