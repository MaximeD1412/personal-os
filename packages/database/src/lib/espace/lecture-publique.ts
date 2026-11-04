import { ErreurDEspace } from './erreur-d-espace';
import { relationsDe, type SchemaDEspace } from './modeles';

/**
 * Ce que le portfolio public peut lire, et à quelle condition : rien d'autre
 * que des contenus à l'état « publié » (ADR 0019, SEC-2). Un modèle absent
 * d'ici ne se lit pas du tout sous la portée publique, qu'il porte un Espace
 * ou non : les Projets, leurs notes et leurs dépenses, les Comptes, les
 * sessions. C'est le même raisonnement que l'API fermée par défaut
 * (ADR 0026) : un contenu ne devient public que par une ligne écrite ici.
 */
export const CONTENUS_PUBLICS: Readonly<
  Record<string, Readonly<Record<string, unknown>>>
> = {
  PublicPresentation: { publicationState: 'PUBLISHED' },
  PageContent: { publicationState: 'PUBLISHED' },
};

/** Les seules opérations permises : des lectures. */
const LECTURES = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'count',
]);

/** Les combinateurs d'un filtre, qui en contiennent d'autres. */
const COMBINATEURS = new Set(['AND', 'OR', 'NOT']);

/**
 * Borne une opération à la lecture publique : un modèle publiable, une
 * lecture, aucune relation suivie (ni `include`, ni relation dans `select` ou
 * `where`), et le filtre « publié » ajouté par `AND`, comme celui des Espaces.
 * Le filtre par Espace, lui, ne s'applique pas : le portfolio lit le publié de
 * tous les Espaces.
 */
export function bornerALaLecturePublique(
  model: string | undefined,
  operation: string,
  args: Record<string, unknown>,
  schema: SchemaDEspace,
): Record<string, unknown> {
  const condition = model === undefined ? undefined : CONTENUS_PUBLICS[model];
  if (!condition) {
    throw refus(
      `${model ?? 'Ce modèle'} ne se lit pas depuis le portfolio public.`,
    );
  }
  if (!LECTURES.has(operation)) {
    throw refus(
      `Le portfolio public n'écrit rien (${operation} sur ${model}).`,
    );
  }

  const relations = Object.keys(relationsDe(model ?? '', schema));
  if ('include' in args) {
    throw refusDeRelation(model);
  }
  if (nommeUneRelation(args['select'], relations, false)) {
    throw refusDeRelation(model);
  }
  if (nommeUneRelation(args['where'], relations, true)) {
    throw refusDeRelation(model);
  }

  const where =
    args['where'] && typeof args['where'] === 'object'
      ? (args['where'] as Record<string, unknown>)
      : {};
  const et = where['AND'];

  return {
    ...args,
    where: {
      ...where,
      AND: [
        ...(Array.isArray(et) ? et : et === undefined ? [] : [et]),
        condition,
      ],
    },
  };
}

/** Une clé de relation, au premier niveau ou sous un combinateur du filtre. */
function nommeUneRelation(
  valeur: unknown,
  relations: readonly string[],
  combinateurs: boolean,
): boolean {
  if (Array.isArray(valeur)) {
    return valeur.some((element) =>
      nommeUneRelation(element, relations, combinateurs),
    );
  }
  if (!valeur || typeof valeur !== 'object') {
    return false;
  }

  return Object.entries(valeur).some(
    ([cle, sous]) =>
      relations.includes(cle) ||
      (combinateurs &&
        COMBINATEURS.has(cle) &&
        nommeUneRelation(sous, relations, combinateurs)),
  );
}

function refusDeRelation(model: string | undefined): ErreurDEspace {
  return refus(
    `Le portfolio public ne suit aucune relation de ${model ?? 'ce modèle'} : un Projet et ses notes restent privés.`,
  );
}

function refus(message: string): ErreurDEspace {
  return new ErreurDEspace('lecture-publique', message);
}
