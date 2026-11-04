import * as z from 'zod';
import { zInstant } from './valeurs';

/** Le module des sauvegardes, tel qu'il se résume au tableau de bord. */
export const MODULE_SAUVEGARDES = 'backup';

/**
 * L'indicateur « Dernière sauvegarde » : sa valeur est l'instant où la
 * dernière sauvegarde réussie s'est terminée (`zInstant`), que l'écran écrit
 * en date. Il est absent tant qu'aucune n'a réussi.
 */
export const INDICATEUR_DERNIERE_SAUVEGARDE = 'backup_last_success';

/**
 * Au-delà de cette durée sans sauvegarde réussie, le module le signale : une
 * sauvegarde quotidienne, plus sa marge. C'est le seuil de la vérification de
 * fraîcheur de l'agent (`infra/backup/bin/watch.sh`).
 */
export const SEUIL_DE_FRAICHEUR_HEURES = 26;

/**
 * Ce que l'agent de sauvegarde transmet à la fin de chaque exécution : quand
 * elle s'est terminée, et si elle a échoué, pourquoi. Un échec dit toujours sa
 * cause ; une réussite n'en a pas.
 */
export const zBackupRunReport = /* @__PURE__ */ z.discriminatedUnion(
  'outcome',
  [
    /* @__PURE__ */ z.object({
      outcome: /* @__PURE__ */ z.literal('SUCCEEDED'),
      finishedAt: zInstant,
    }),
    /* @__PURE__ */ z.object({
      outcome: /* @__PURE__ */ z.literal('FAILED'),
      finishedAt: zInstant,
      error: /* @__PURE__ */ z.string().trim().min(1).max(2000),
    }),
  ],
);

export type BackupRunReport = z.infer<typeof zBackupRunReport>;

/** Le dernier état connu des sauvegardes. */
export const zBackupStatus = /* @__PURE__ */ z.object({
  /** La fin de la dernière sauvegarde réussie ; `null` si aucune ne l'a été. */
  lastSuccessAt: zInstant.nullable(),
  /** La fin de la dernière exécution, réussie ou non. */
  lastRunAt: zInstant,
  /** La cause du dernier échec ; `null` depuis la dernière réussite. */
  lastError: /* @__PURE__ */ z.string().nullable(),
});

export type BackupStatus = z.infer<typeof zBackupStatus>;
