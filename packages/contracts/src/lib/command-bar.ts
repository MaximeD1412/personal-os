import * as z from 'zod';

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
