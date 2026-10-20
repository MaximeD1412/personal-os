import * as z from 'zod';
import { zLang, zPublicationState } from './publication';
import { zInstant } from './valeurs';

/**
 * Les Pages de contenu du portfolio : la présentation, les expériences et les
 * compétences, rédigées en prose dans chaque langue. Il n'existe ni entité
 * Expérience, ni entité Compétence (ADR 0019). Elles sont globales, hors
 * Espace.
 */

/** Les trois pages de la V1, dans l'ordre du portfolio. */
export const PAGES_DE_CONTENU = ['about', 'experience', 'skills'] as const;

export const zPageSlug = /* @__PURE__ */ z.enum(PAGES_DE_CONTENU);

export type PageSlug = z.infer<typeof zPageSlug>;

export const LIBELLES_DES_PAGES: Readonly<Record<PageSlug, string>> = {
  about: 'Présentation',
  experience: 'Expériences',
  skills: 'Compétences',
};

/** Le paramètre de route d'une Page de contenu : la page et la langue. */
export const zPageContentKey = /* @__PURE__ */ z.object({
  slug: zPageSlug,
  lang: zLang,
});

export const zPageContent = /* @__PURE__ */ z.object({
  id: /* @__PURE__ */ z.string(),
  slug: zPageSlug,
  lang: zLang,
  title: /* @__PURE__ */ z.string(),
  /** Le texte, en markdown, rendu côté front. */
  body: /* @__PURE__ */ z.string(),
  publicationState: zPublicationState,
  updatedAt: zInstant,
});

export type PageContent = z.infer<typeof zPageContent>;

/**
 * Ce qu'une rédaction porte : le texte entier, jamais l'État de publication,
 * qui ne change que par ses transitions (ADR 0030).
 */
export const zPageContentInput = /* @__PURE__ */ z.object({
  title: /* @__PURE__ */ z.string().trim().min(1).max(120),
  body: /* @__PURE__ */ z.string().max(100_000).default(''),
});

export type PageContentInput = z.input<typeof zPageContentInput>;
