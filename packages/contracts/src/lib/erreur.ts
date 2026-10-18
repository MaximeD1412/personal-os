import { z } from 'zod';

/**
 * L'enveloppe de toute erreur de l'API (ADR 0030). `code` est stable, en
 * anglais (`<module>.<cas>`) : c'est lui que testent les tests et que lit la
 * logique du front. `message` est en français et s'affiche tel quel.
 */

/** Un champ refusé par le schéma d'entrée. `path` est joint par des points. */
export const zApiFieldError = /* @__PURE__ */ z.object({
  path: /* @__PURE__ */ z.string(),
  code: /* @__PURE__ */ z.string(),
  message: /* @__PURE__ */ z.string(),
});

export const zApiError = /* @__PURE__ */ z.object({
  status: /* @__PURE__ */ z.int(),
  code: /* @__PURE__ */ z.string(),
  message: /* @__PURE__ */ z.string(),
  /** N'apparaît que pour une erreur de validation. */
  fields: /* @__PURE__ */ z.array(zApiFieldError).optional(),
});

export type ApiFieldError = z.infer<typeof zApiFieldError>;
export type ApiError = z.infer<typeof zApiError>;
