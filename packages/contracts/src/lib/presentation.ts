import * as z from 'zod';
import { zLang, zPublicationState } from './publication';
import { zInstant } from './valeurs';

/**
 * La Présentation publique d'un Projet : son texte destiné au portfolio, dans
 * une langue. Elle ne reprend rien des notes privées du Projet (ADR 0019).
 */

/** Le paramètre de route d'une Présentation publique : le Projet et la langue. */
export const zPublicPresentationKey = /* @__PURE__ */ z.object({
  id: /* @__PURE__ */ z.string(),
  lang: zLang,
});

export const zPublicPresentation = /* @__PURE__ */ z.object({
  id: /* @__PURE__ */ z.string(),
  projectId: /* @__PURE__ */ z.string(),
  lang: zLang,
  title: /* @__PURE__ */ z.string(),
  summary: /* @__PURE__ */ z.string(),
  /** Le texte, en markdown, rendu côté front. */
  body: /* @__PURE__ */ z.string(),
  publicationState: zPublicationState,
  /** L'instant de la mise en ligne ; vide tant que la présentation n'est pas publiée. */
  publishedAt: /* @__PURE__ */ zInstant.nullable(),
  updatedAt: zInstant,
});

export type PublicPresentation = z.infer<typeof zPublicPresentation>;

/**
 * Ce qu'une rédaction porte : le texte entier, jamais l'État de publication,
 * qui ne change que par ses transitions (ADR 0030).
 */
export const zPublicPresentationInput = /* @__PURE__ */ z.object({
  title: /* @__PURE__ */ z.string().trim().min(1).max(120),
  /** L'accroche, une ou deux phrases. */
  summary: /* @__PURE__ */ z.string().trim().min(1).max(300),
  body: /* @__PURE__ */ z.string().max(100_000).default(''),
});

export type PublicPresentationInput = z.input<typeof zPublicPresentationInput>;
