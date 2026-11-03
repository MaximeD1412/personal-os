import * as z from 'zod';
import { zDay } from './valeurs';

/**
 * Le chemin d'un écran du tableau de bord, requête comprise
 * (`/repas/planning?semaine=2026-11-02`). C'est le module qui le donne, parce
 * que lui seul sait quel écran résout sa situation : le tableau de bord ne
 * connaît aucun module (ADR 0011).
 */
export const zScreenLink = /* @__PURE__ */ z.string().startsWith('/');

/** Une valeur qu'un module affiche telle quelle : un nombre, ou un texte. */
export const zSummaryIndicator = /* @__PURE__ */ z.object({
  /** Stable, en anglais : c'est par elle que l'écran choisit son widget. */
  key: /* @__PURE__ */ z.string(),
  label: /* @__PURE__ */ z.string(),
  value: /* @__PURE__ */ z.union([
    /* @__PURE__ */ z.number(),
    /* @__PURE__ */ z.string(),
  ]),
});

export type SummaryIndicator = z.infer<typeof zSummaryIndicator>;

/**
 * Une situation d'un module qui requiert l'attention, telle qu'il la constate
 * à l'instant de la lecture. Rien ne la stocke : elle cesse d'exister quand la
 * situation change (ADR 0017).
 */
export const zSignal = /* @__PURE__ */ z.object({
  /** Le cas, `<module>.<cas>` en anglais, comme un code d'erreur. */
  kind: /* @__PURE__ */ z.string(),
  /** L'objet du module qui produit la situation. */
  ref: /* @__PURE__ */ z.string(),
  label: /* @__PURE__ */ z.string(),
  /** Le jour où la situation devient pressante, quand elle en a un. */
  dueOn: /* @__PURE__ */ zDay.optional(),
  /** L'écran qui la résout. */
  link: zScreenLink,
});

export type Signal = z.infer<typeof zSignal>;

/**
 * Le Résumé d'un module : ses indicateurs (articles restants, prochaine
 * séance) et ses signaux. Chaque module expose le sien, sans passer par
 * l'Agenda : un port unique aurait produit une union grossissant à chaque
 * besoin d'affichage (ADR 0011).
 */
export const zModuleSummary = /* @__PURE__ */ z.object({
  /**
   * L'identifiant du module. Une chaîne libre et non une union : un module
   * nouveau se résume sans que les contrats ni le tableau de bord le
   * connaissent d'avance.
   */
  module: /* @__PURE__ */ z.string(),
  indicators: /* @__PURE__ */ z.array(zSummaryIndicator),
  signals: /* @__PURE__ */ z.array(zSignal),
});

export type ModuleSummary = z.infer<typeof zModuleSummary>;

/**
 * Un À faire : un signal, rendu au tableau de bord avec le module qui l'a
 * émis. Il ne se coche pas ; il disparaît avec sa situation (ADR 0017).
 */
export const zTodo = /* @__PURE__ */ zSignal.extend({
  module: /* @__PURE__ */ z.string(),
});

export type Todo = z.infer<typeof zTodo>;

/**
 * Le port par lequel un module se résume au tableau de bord. Chaque module
 * l'implémente et s'enregistre ; le tableau de bord ne connaît aucun module,
 * et en ajouter un ne le modifie pas (ADR 0011).
 */
export interface ResumeurDeModule {
  /** L'identifiant du module, repris tel quel dans `ModuleSummary.module`. */
  readonly module: string;

  /**
   * L'état du module à cet instant. Le cloisonnement par Espace n'est pas son
   * affaire : il lit par les chemins ordinaires, et la garde borne ses
   * requêtes (ADR 0028).
   */
  resumer(maintenant: Date): Promise<ModuleSummary>;
}
