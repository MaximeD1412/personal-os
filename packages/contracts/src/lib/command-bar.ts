import * as z from 'zod';
import { zInstant } from './valeurs';

/**
 * Ce que l'action attend d'un champ prérempli : `required`, la barre ne peut
 * pas la proposer sans lui ; `optional`, elle le remplit si la phrase le donne.
 */
export const zCommandParamUsage = /* @__PURE__ */ z.enum([
  'required',
  'optional',
]);

export type CommandParamUsage = z.infer<typeof zCommandParamUsage>;

/** Une phrase non vide. */
const zPhrase = /* @__PURE__ */ z.string().trim().min(1);

/** L'URL d'un écran du front, sans paramètres : la barre les ajoute. */
const zScreen = /* @__PURE__ */ z.string().regex(/^\/[^?#]*$/);

/**
 * L'annotation qui ouvre un endpoint à la barre de commande (ADR 0018). Le
 * décorateur `@Command` la pose dans l'OpenAPI, sous l'extension `x-command`.
 * `params` nomme les champs du schéma d'entrée que la barre peut préremplir :
 * le formulaire de `screen` les lit dans ses paramètres de requête (ADR 0030).
 */
export const zCommandAnnotation = /* @__PURE__ */ z.object({
  intent: zPhrase,
  examples: /* @__PURE__ */ z.array(zPhrase).min(1),
  screen: zScreen,
  params: /* @__PURE__ */ z.record(z.string().min(1), zCommandParamUsage),
});

export type CommandAnnotation = z.infer<typeof zCommandAnnotation>;

/** Un schéma JSON, tel que l'OpenAPI le déduit des schémas zod. */
export const zJsonSchema = /* @__PURE__ */ z.record(z.string(), z.unknown());

export type JsonSchema = z.infer<typeof zJsonSchema>;

/** Un champ que la barre peut préremplir, avec le schéma qui le valide. */
export const zCommandParam = /* @__PURE__ */ z.object({
  required: /* @__PURE__ */ z.boolean(),
  schema: zJsonSchema,
});

export type CommandParam = z.infer<typeof zCommandParam>;

/**
 * Une action du catalogue : une opération annotée de l'API, vue par la barre.
 * Elle ne porte ni la méthode ni le chemin de l'opération : la barre ne
 * connaît que des écrans à ouvrir, jamais une route à appeler (ADR 0018).
 */
export const zCommandAction = /* @__PURE__ */ z.object({
  id: /* @__PURE__ */ z.string().min(1),
  intent: zPhrase,
  examples: /* @__PURE__ */ z.array(zPhrase).min(1),
  screen: zScreen,
  params: /* @__PURE__ */ z.record(z.string(), zCommandParam),
});

export type CommandAction = z.infer<typeof zCommandAction>;

/**
 * Le catalogue fermé des actions de la barre de commande, généré au build
 * depuis les endpoints annotés (`nx run api:command-catalog`). Il est versionné
 * dans `src/generated/command-catalog.json`.
 */
export const zCommandCatalog = /* @__PURE__ */ z.object({
  actions: /* @__PURE__ */ z.array(zCommandAction),
});

export type CommandCatalog = z.infer<typeof zCommandCatalog>;

/** La plus longue commande que la barre accepte. */
export const COMMANDE_LONGUEUR_MAX = 500;

/**
 * Une commande, telle que l'utilisateur l'a tapée dans la barre. Elle n'est
 * pas retouchée, pas même rognée : une commande non comprise se journalise
 * mot pour mot.
 */
export const zCommandResolveInput = /* @__PURE__ */ z.object({
  text: /* @__PURE__ */ z
    .string()
    .max(COMMANDE_LONGUEUR_MAX)
    .regex(/\S/, 'La commande est vide.'),
});

export type CommandResolveInput = z.infer<typeof zCommandResolveInput>;

/**
 * Ce que la barre fait d'une commande (ADR 0018) : elle ouvre le formulaire
 * prérempli d'une action (`url`), en signalant les paramètres proposés mais
 * écartés (`ignored`) ; ou elle dit qu'aucune action ne correspond, avec
 * l'écran le plus proche s'il y en a un. Elle n'exécute jamais rien.
 */
export const zCommandResolution = /* @__PURE__ */ z.discriminatedUnion('kind', [
  /* @__PURE__ */ z.object({
    kind: /* @__PURE__ */ z.literal('action'),
    url: /* @__PURE__ */ z.string(),
    ignored: /* @__PURE__ */ z.array(z.string()),
  }),
  /* @__PURE__ */ z.object({
    kind: /* @__PURE__ */ z.literal('none'),
    nearestUrl: /* @__PURE__ */ z.string().optional(),
  }),
]);

export type CommandResolution = z.infer<typeof zCommandResolution>;

/** La taille d'une page du journal des commandes non comprises, par défaut. */
export const UNRESOLVED_COMMAND_PAGE_PAR_DEFAUT = 50;

/** La plus grande page qu'une lecture de ce journal peut demander. */
export const UNRESOLVED_COMMAND_PAGE_MAX = 100;

/**
 * Une commande que la barre n'a pas comprise, journalisée mot pour mot dans
 * l'Espace personnel de son auteur : ce journal est la file de travail du
 * catalogue (ADR 0018).
 */
export const zUnresolvedCommand = /* @__PURE__ */ z.object({
  id: /* @__PURE__ */ z.string(),
  scopeId: /* @__PURE__ */ z.string(),
  text: /* @__PURE__ */ z.string(),
  createdAt: zInstant,
});

export type UnresolvedCommand = z.infer<typeof zUnresolvedCommand>;

/**
 * Le journal est en ajout seul : il se lit par curseur, des plus récentes aux
 * plus anciennes (ADR 0030). Le curseur est l'identifiant de la dernière
 * commande de la page précédente.
 */
export const zUnresolvedCommandListQuery = /* @__PURE__ */ z.object({
  cursor: /* @__PURE__ */ z.uuid().optional(),
  limit: /* @__PURE__ */ z.coerce
    .number()
    .int()
    .min(1)
    .max(UNRESOLVED_COMMAND_PAGE_MAX)
    .default(UNRESOLVED_COMMAND_PAGE_PAR_DEFAUT),
});

export type UnresolvedCommandListQuery = z.infer<
  typeof zUnresolvedCommandListQuery
>;

/** Une page du journal. `nextCursor` est vide quand il n'y a plus rien. */
export const zUnresolvedCommandPage = /* @__PURE__ */ z.object({
  items: /* @__PURE__ */ z.array(zUnresolvedCommand),
  nextCursor: /* @__PURE__ */ z.string().nullable(),
});

export type UnresolvedCommandPage = z.infer<typeof zUnresolvedCommandPage>;
