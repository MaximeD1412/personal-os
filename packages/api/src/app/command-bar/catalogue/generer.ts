import type { OpenAPIObject } from '@nestjs/swagger';
import {
  type CommandAction,
  type CommandAnnotation,
  type CommandCatalog,
  type JsonSchema,
  zCommandAnnotation,
} from '@personal-os/contracts';

/** L'extension que `@Command` pose sur une opération de l'OpenAPI. */
export const EXTENSION_COMMANDE = 'x-command';

const VERBES = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
] as const;

/** Une annotation que le schéma de l'opération dément : le build s'arrête. */
export class CatalogueIncoherent extends Error {
  constructor(readonly incoherences: string[]) {
    super(
      [
        'Le catalogue de la barre de commande ne peut pas être généré :',
        ...incoherences.map((incoherence) => `- ${incoherence}`),
      ].join('\n'),
    );
    this.name = 'CatalogueIncoherent';
  }
}

type Objet = Record<string, unknown>;

/**
 * `(OpenAPI + annotations) → catalogue` (ADR 0018). Une action par opération
 * annotée, et rien d'autre : une opération sans `x-command` n'existe pas pour
 * la barre. Les champs d'une action reprennent le schéma de l'API, sans
 * recopie : une annotation qui nomme un champ que ce schéma n'a pas fait
 * échouer la génération, plutôt que de laisser la barre préremplir un champ
 * que le formulaire ne connaît pas.
 *
 * Toutes les incohérences sont signalées ensemble, dans `CatalogueIncoherent`.
 */
export function genererCatalogue(openapi: OpenAPIObject): CommandCatalog {
  const actions: CommandAction[] = [];
  const incoherences: string[] = [];
  const identifiants = new Set<string>();

  for (const [chemin, item] of Object.entries(openapi.paths)) {
    for (const verbe of VERBES) {
      const operation = item[verbe] as Objet | undefined;
      if (operation?.[EXTENSION_COMMANDE] === undefined) {
        continue;
      }

      const id = operation['operationId'];
      const nom =
        typeof id === 'string' ? id : `${verbe.toUpperCase()} ${chemin}`;

      try {
        if (typeof id !== 'string') {
          throw new Error("l'opération n'a pas d'identifiant (operationId).");
        }
        if (identifiants.has(id)) {
          throw new Error('un autre endpoint annoté porte cet identifiant.');
        }
        identifiants.add(id);

        actions.push(
          action(
            id,
            annotation(operation[EXTENSION_COMMANDE]),
            champsDEntree(openapi, item as Objet, operation),
            openapi,
          ),
        );
      } catch (erreur) {
        incoherences.push(`${nom} : ${(erreur as Error).message}`);
      }
    }
  }

  if (incoherences.length > 0) {
    throw new CatalogueIncoherent(incoherences);
  }

  return {
    actions: actions.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
  };
}

function annotation(extension: unknown): CommandAnnotation {
  const lue = zCommandAnnotation.safeParse(extension);
  if (!lue.success) {
    throw new Error(
      lue.error.issues
        .map(({ path, message }) => `${path.join('.')} : ${message}`)
        .join(' ; '),
    );
  }
  return lue.data;
}

function action(
  id: string,
  { intent, examples, screen, params }: CommandAnnotation,
  champs: Map<string, unknown>,
  openapi: OpenAPIObject,
): CommandAction {
  const absents = Object.keys(params).filter((champ) => !champs.has(champ));
  if (absents.length > 0) {
    const connus = [...champs.keys()].join(', ') || 'aucun';
    throw new Error(
      `${absents.map((champ) => `« ${champ} »`).join(', ')} absent du schéma d'entrée (champs : ${connus}).`,
    );
  }

  return {
    id,
    intent,
    examples,
    screen,
    params: Object.fromEntries(
      Object.entries(params).map(([champ, usage]) => [
        champ,
        {
          required: usage === 'required',
          schema: deplier(openapi, champs.get(champ), []) as JsonSchema,
        },
      ]),
    ),
  };
}

/**
 * Les champs d'entrée d'une opération : ceux du corps JSON, puis les
 * paramètres de chemin et de requête. C'est sous ces noms que le formulaire
 * les lit dans son URL (ADR 0030).
 */
function champsDEntree(
  openapi: OpenAPIObject,
  item: Objet,
  operation: Objet,
): Map<string, unknown> {
  const champs = new Map<string, unknown>();

  const corps = resoudre(openapi, operation['requestBody']) as
    | { content?: Record<string, { schema?: unknown }> }
    | undefined;
  for (const [champ, propriete] of proprietes(
    openapi,
    corps?.content?.['application/json']?.schema,
    [],
  )) {
    champs.set(champ, propriete);
  }

  const parametres = [
    ...((item['parameters'] as unknown[] | undefined) ?? []),
    ...((operation['parameters'] as unknown[] | undefined) ?? []),
  ].map((parametre) => resoudre(openapi, parametre) as Objet);
  for (const parametre of parametres) {
    if (parametre['in'] === 'path' || parametre['in'] === 'query') {
      champs.set(parametre['name'] as string, parametre['schema'] ?? {});
    }
  }

  return champs;
}

/**
 * Les propriétés d'un schéma d'objet, y compris composé : une union
 * (`oneOf`, `anyOf`, ce que donne une union discriminée de zod) a pour champs
 * ceux de ses variantes, et une intersection (`allOf`) ceux de ses membres.
 * Un champ garde chaque contrainte que le schéma lui pose : celles des
 * membres d'une intersection s'ajoutent (`allOf`), celles de variantes qui
 * diffèrent s'offrent au choix (`anyOf`).
 */
function proprietes(
  openapi: OpenAPIObject,
  schema: unknown,
  pile: string[],
): Map<string, unknown> {
  const ref = (schema as Objet | undefined)?.['$ref'];
  if (typeof ref === 'string') {
    if (pile.includes(ref)) {
      throw new Error(`le schéma ${ref} est récursif : il ne se lit pas.`);
    }
    pile = [...pile, ref];
  }

  const objet = resoudre(openapi, schema) as Objet | undefined;
  if (objet === null || typeof objet !== 'object') {
    return new Map();
  }

  const membres = (cle: string) =>
    ((objet[cle] as unknown[] | undefined) ?? []).map((membre) =>
      proprietes(openapi, membre, pile),
    );

  return combiner(
    [
      new Map(Object.entries((objet['properties'] as Objet | undefined) ?? {})),
      combiner(membres('allOf'), 'allOf'),
      combiner([...membres('oneOf'), ...membres('anyOf')], 'anyOf'),
    ],
    'allOf',
  );
}

/** Réunit les champs de plusieurs schémas ; un champ décrit différemment par plusieurs d'entre eux prend tous ses schémas, sous `mot`. */
function combiner(
  schemas: Map<string, unknown>[],
  mot: 'allOf' | 'anyOf',
): Map<string, unknown> {
  const parChamp = new Map<string, unknown[]>();
  for (const schema of schemas) {
    for (const [champ, propriete] of schema) {
      const connus = parChamp.get(champ) ?? [];
      if (
        !connus.some(
          (connu) => JSON.stringify(connu) === JSON.stringify(propriete),
        )
      ) {
        connus.push(propriete);
      }
      parChamp.set(champ, connus);
    }
  }

  return new Map(
    [...parChamp].map(([champ, connus]) => [
      champ,
      connus.length === 1 ? connus[0] : { [mot]: connus },
    ]),
  );
}

/** Suit les `$ref` d'un objet jusqu'à l'objet qu'ils désignent. */
function resoudre(
  openapi: OpenAPIObject,
  objet: unknown,
  vus: string[] = [],
): unknown {
  const ref = (objet as Objet | undefined)?.['$ref'];
  if (typeof ref !== 'string') {
    return objet;
  }
  if (vus.includes(ref)) {
    throw new Error(`la référence ${ref} se désigne elle-même.`);
  }

  const cible = ref
    .replace(/^#\//, '')
    .split('/')
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce<unknown>(
      (courant, segment) => (courant as Objet | undefined)?.[segment],
      openapi,
    );
  if (cible === undefined) {
    throw new Error(`la référence ${ref} ne désigne rien.`);
  }

  return resoudre(openapi, cible, [...vus, ref]);
}

/**
 * Recopie un schéma en remplaçant chaque `$ref` par ce qu'il désigne : une
 * action se lit seule, sans le reste de l'OpenAPI.
 */
function deplier(
  openapi: OpenAPIObject,
  schema: unknown,
  pile: string[],
): unknown {
  if (Array.isArray(schema)) {
    return schema.map((element) => deplier(openapi, element, pile));
  }
  if (schema === null || typeof schema !== 'object') {
    return schema;
  }

  const { $ref: ref, ...reste } = schema as Objet;
  const deplie = Object.fromEntries(
    Object.entries(reste).map(([cle, valeur]) => [
      cle,
      deplier(openapi, valeur, pile),
    ]),
  );
  if (typeof ref !== 'string') {
    return deplie;
  }
  if (pile.includes(ref)) {
    throw new Error(
      `le schéma ${ref} est récursif : il ne se recopie pas dans une action.`,
    );
  }

  return {
    ...(deplier(openapi, resoudre(openapi, { $ref: ref }), [
      ...pile,
      ref,
    ]) as Objet),
    ...deplie,
  };
}
