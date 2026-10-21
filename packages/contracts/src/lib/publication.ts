import * as z from 'zod';

/**
 * Ce qui part vers le portfolio : une langue, et un État de publication. Les
 * Présentations publiques (PORTFOLIO-2) et les Pages de contenu (PORTFOLIO-3)
 * partagent l'une et l'autre.
 */

/** Le portfolio existe en français et en anglais, sans repli de l'un sur l'autre (ADR 0019). */
export const LANGUES = ['FR', 'EN'] as const;

export const zLang = /* @__PURE__ */ z.enum(LANGUES);

export type Lang = z.infer<typeof zLang>;

export const LIBELLES_DES_LANGUES: Readonly<Record<Lang, string>> = {
  FR: 'Français',
  EN: 'Anglais',
};
