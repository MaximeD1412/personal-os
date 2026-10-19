import * as z from 'zod';
import { zCents, zInstant } from './valeurs';

/** La taille d'une page du journal des traces, quand la lecture n'en dit rien. */
export const AI_TRACE_PAGE_PAR_DEFAUT = 50;

/** La plus grande page qu'une lecture du journal peut demander. */
export const AI_TRACE_PAGE_MAX = 100;

/** Un compte de jetons, vide quand le fournisseur n'a pas répondu. */
const zTokens = /* @__PURE__ */ z.int().min(0).nullable();

/**
 * Une trace d'appel au modèle d'IA, telle qu'on la parcourt dans le journal :
 * qui l'a demandée (`purpose`), quel modèle a répondu, ce que cela a coûté, et
 * pourquoi l'appel n'a rien rendu d'utilisable (`error` : une panne du
 * fournisseur, une sortie hors schéma), vide pour une réponse retenue. Le
 * texte de l'échange ne se lit que trace par trace.
 */
export const zAiTraceSummary = /* @__PURE__ */ z.object({
  id: /* @__PURE__ */ z.string(),
  scopeId: /* @__PURE__ */ z.string(),
  purpose: /* @__PURE__ */ z.string(),
  model: /* @__PURE__ */ z.string(),
  inputTokens: zTokens,
  outputTokens: zTokens,
  costCents: zCents,
  error: /* @__PURE__ */ z.string().nullable(),
  createdAt: zInstant,
});

export type AiTraceSummary = z.infer<typeof zAiTraceSummary>;

/**
 * Une trace complète : la consigne (`system`), la demande (`input`) et la
 * réponse brute (`output`), avant toute validation, vide quand le fournisseur
 * n'a pas répondu. C'est ce qui permet de comprendre une proposition étrange.
 */
export const zAiTrace = /* @__PURE__ */ zAiTraceSummary.extend({
  system: /* @__PURE__ */ z.string(),
  input: /* @__PURE__ */ z.string(),
  output: /* @__PURE__ */ z.string().nullable(),
});

export type AiTrace = z.infer<typeof zAiTrace>;

/**
 * Le journal des traces est en ajout seul : il se lit par curseur, des plus
 * récentes aux plus anciennes (ADR 0030). Le curseur est l'identifiant de la
 * dernière trace de la page précédente.
 */
export const zAiTraceListQuery = /* @__PURE__ */ z.object({
  cursor: /* @__PURE__ */ z.uuid().optional(),
  limit: /* @__PURE__ */ z.coerce
    .number()
    .int()
    .min(1)
    .max(AI_TRACE_PAGE_MAX)
    .default(AI_TRACE_PAGE_PAR_DEFAUT),
});

export type AiTraceListQuery = z.infer<typeof zAiTraceListQuery>;

/** Une page du journal. `nextCursor` est vide quand il n'y a plus rien. */
export const zAiTracePage = /* @__PURE__ */ z.object({
  items: /* @__PURE__ */ z.array(zAiTraceSummary),
  nextCursor: /* @__PURE__ */ z.string().nullable(),
});

export type AiTracePage = z.infer<typeof zAiTracePage>;
