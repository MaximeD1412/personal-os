import * as z from 'zod';
import { zPageSlug } from './page-content';
import { zLang } from './publication';
import { zInstant } from './valeurs';

/**
 * Ce que sert le portfolio public, sans session : des schémas **dédiés**, qui
 * ne reprennent que le texte publié. Ni notes, ni liens, ni dépenses du
 * Projet, ni État de publication, ni Espace (ADR 0019, SEC-2). Le sérialiseur
 * de l'API les applique à chaque réponse : un champ absent d'ici ne sort pas.
 */

/** Les paramètres de `/public/:lang/…` et de `/public/cv/:lang`. */
export const zPublicLangKey = /* @__PURE__ */ z.object({ lang: zLang });

/** Les paramètres de `/public/:lang/pages/:slug`. */
export const zPublicPageKey = /* @__PURE__ */ z.object({
  lang: zLang,
  slug: zPageSlug,
});

/** Les paramètres de `/public/:lang/projects/:id`. */
export const zPublicProjectKey = /* @__PURE__ */ z.object({
  lang: zLang,
  id: /* @__PURE__ */ z.string(),
});

/** Une Page de contenu publiée, dans une langue. */
export const zPublicPage = /* @__PURE__ */ z.object({
  slug: zPageSlug,
  lang: zLang,
  title: /* @__PURE__ */ z.string(),
  /** Le texte, en markdown, rendu côté front. */
  body: /* @__PURE__ */ z.string(),
});

export type PublicPage = z.infer<typeof zPublicPage>;

/**
 * Un Projet dans la liste du portfolio : sa Présentation publique publiée
 * dans la langue demandée, sans son texte. `id` est celui du Projet.
 */
export const zPublicProjectSummary = /* @__PURE__ */ z.object({
  id: /* @__PURE__ */ z.string(),
  lang: zLang,
  title: /* @__PURE__ */ z.string(),
  summary: /* @__PURE__ */ z.string(),
  publishedAt: zInstant,
});

export type PublicProjectSummary = z.infer<typeof zPublicProjectSummary>;

/** Un Projet sur le portfolio : sa Présentation publique publiée, texte compris. */
export const zPublicProject = /* @__PURE__ */ zPublicProjectSummary.extend({
  /** Le texte, en markdown, rendu côté front. */
  body: /* @__PURE__ */ z.string(),
});

export type PublicProject = z.infer<typeof zPublicProject>;
