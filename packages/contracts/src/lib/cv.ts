import * as z from 'zod';
import { zLang } from './publication';
import { zInstant } from './valeurs';

/**
 * Le CV du portfolio : un PDF par langue, téléversé tel quel et rangé dans le
 * stockage objet, hors de la base. Il n'appartient à aucun Espace : le
 * portfolio est unique. Un nouveau téléversement remplace l'ancien.
 */

/** 5 Mo, en octets. */
export const TAILLE_MAX_DU_CV = 5 * 1024 * 1024;

/** Ce qu'on sait d'un CV téléversé, sans en lire le contenu. */
export const zCv = /* @__PURE__ */ z.object({
  lang: zLang,
  /** En octets. */
  size: /* @__PURE__ */ z.int().min(1),
  uploadedAt: zInstant,
});

export type Cv = z.infer<typeof zCv>;

/** Les paramètres de `/cv/:lang`. */
export const zCvKey = /* @__PURE__ */ z.object({ lang: zLang });
