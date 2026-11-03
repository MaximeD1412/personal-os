import * as z from 'zod';
import { zCents, zDay, zInstant, zMoney } from './valeurs';

/**
 * Un Projet de l'Espace personnel : un titre, des notes en markdown, des
 * liens et des dépenses. Les notes restent privées : la Présentation publique
 * (PORTFOLIO-2) n'en reprend rien.
 */

/** Une dépense au-delà d'un million d'euros est une faute de frappe. */
export const MONTANT_MAX_D_UNE_DEPENSE = 100_000_000;

type Montant = z.infer<typeof zMoney>;

/**
 * Le total des dépenses d'un Projet, en entier de centimes : aucun euro en
 * virgule flottante, la somme tombe juste. Toutes les dépenses sont en euros
 * (ADR 0030) : la devise du total est la leur.
 */
export function totalDesDepenses(montants: readonly Montant[]): Montant {
  return {
    cents: montants.reduce((total, { cents }) => total + cents, 0),
    currency: 'EUR',
  };
}

const zTitle = /* @__PURE__ */ z.string().trim().min(1).max(120);

/** Des notes en markdown, rendues côté front. */
const zNotes = /* @__PURE__ */ z.string().max(100_000);

/** Un lien du Projet : un libellé et une adresse web, jamais un autre schéma. */
export const zProjectLink = /* @__PURE__ */ z.object({
  label: /* @__PURE__ */ z.string().trim().min(1).max(120),
  url: /* @__PURE__ */ z
    .url({
      protocol: /^https?$/,
      error: 'Un lien est une adresse web, en http ou https.',
    })
    .max(2048),
});

export type ProjectLink = z.infer<typeof zProjectLink>;

const zLinks = /* @__PURE__ */ z.array(zProjectLink).max(50);

/** Une dépense du Projet, datée d'un jour civil. */
export const zProjectExpense = /* @__PURE__ */ z.object({
  id: /* @__PURE__ */ z.string(),
  projectId: /* @__PURE__ */ z.string(),
  label: /* @__PURE__ */ z.string(),
  amount: zMoney,
  spentOn: zDay,
  createdAt: zInstant,
});

export type ProjectExpense = z.infer<typeof zProjectExpense>;

/** Un Projet lu en entier : ses dépenses, de la plus récente à la plus ancienne, et leur total. */
export const zProject = /* @__PURE__ */ z.object({
  id: /* @__PURE__ */ z.string(),
  scopeId: /* @__PURE__ */ z.string(),
  title: /* @__PURE__ */ z.string(),
  notes: /* @__PURE__ */ z.string(),
  links: /* @__PURE__ */ z.array(zProjectLink),
  expenses: /* @__PURE__ */ z.array(zProjectExpense),
  totalSpent: zMoney,
  createdAt: zInstant,
  updatedAt: zInstant,
});

export type Project = z.infer<typeof zProject>;

/** Un Projet dans la liste : ni notes, ni liens, ni le détail des dépenses. */
export const zProjectSummary = /* @__PURE__ */ z.object({
  id: /* @__PURE__ */ z.string(),
  scopeId: /* @__PURE__ */ z.string(),
  title: /* @__PURE__ */ z.string(),
  totalSpent: zMoney,
  updatedAt: zInstant,
});

export type ProjectSummary = z.infer<typeof zProjectSummary>;

/**
 * Ce qu'une création porte. L'Espace ne se saisit pas : un Projet vit
 * toujours dans l'Espace personnel de son Compte, que le module pose lui-même.
 */
export const zProjectInput = /* @__PURE__ */ z.object({
  title: zTitle,
  notes: /* @__PURE__ */ zNotes.default(''),
  links: /* @__PURE__ */ zLinks.default([]),
});

export type ProjectInput = z.infer<typeof zProjectInput>;

/** Une modification ne porte que ce qu'elle change, sans valeur par défaut. */
export const zProjectUpdate = /* @__PURE__ */ z
  .object({ title: zTitle, notes: zNotes, links: zLinks })
  .partial();

export type ProjectUpdate = z.infer<typeof zProjectUpdate>;

/** Ce qu'une dépense saisie porte : un libellé, un montant en centimes, un jour. */
export const zProjectExpenseInput = /* @__PURE__ */ z.object({
  label: /* @__PURE__ */ z.string().trim().min(1).max(120),
  amount: /* @__PURE__ */ zMoney.extend({
    cents: /* @__PURE__ */ zCents.max(MONTANT_MAX_D_UNE_DEPENSE),
  }),
  spentOn: zDay,
});

export type ProjectExpenseInput = z.infer<typeof zProjectExpenseInput>;
