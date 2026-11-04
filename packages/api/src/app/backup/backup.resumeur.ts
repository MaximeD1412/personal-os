import { Injectable, type OnModuleInit } from '@nestjs/common';
import {
  aujourdhui,
  FUSEAU,
  INDICATEUR_DERNIERE_SAUVEGARDE,
  MODULE_SAUVEGARDES,
  SEUIL_DE_FRAICHEUR_HEURES,
  type BackupStatus,
  type ModuleSummary,
  type ResumeurDeModule,
  type Signal,
} from '@personal-os/contracts';
import { SummaryRegistry } from '../dashboard-port/summary.registry';
import { BackupStatusRepository } from './backup-status.repository';

const SEUIL_MS = SEUIL_DE_FRAICHEUR_HEURES * 60 * 60 * 1000;

/**
 * Les sauvegardes telles qu'elles se résument au tableau de bord : la date de
 * la dernière réussie, et un signal dès qu'elle date de plus de 26 heures, ou
 * qu'aucune n'a jamais réussi. Les sauvegardes sont celles de la machine :
 * les deux Comptes voient le même état.
 */
@Injectable()
export class BackupResumeur implements ResumeurDeModule, OnModuleInit {
  readonly module = MODULE_SAUVEGARDES;

  constructor(
    private readonly etat: BackupStatusRepository,
    private readonly registre: SummaryRegistry,
  ) {}

  onModuleInit(): void {
    this.registre.enregistrer(this);
  }

  async resumer(maintenant: Date): Promise<ModuleSummary> {
    return resumerLesSauvegardes(await this.etat.lire(), maintenant);
  }
}

/** Le résumé d'un état connu, à un instant donné. */
export function resumerLesSauvegardes(
  etat: BackupStatus | null,
  maintenant: Date,
): ModuleSummary {
  const derniere = etat?.lastSuccessAt ?? null;
  return {
    module: MODULE_SAUVEGARDES,
    indicators:
      derniere === null
        ? []
        : [
            {
              key: INDICATEUR_DERNIERE_SAUVEGARDE,
              label: 'Dernière sauvegarde réussie',
              value: derniere,
            },
          ],
    signals: signalDeFraicheur(derniere, maintenant),
  };
}

function signalDeFraicheur(
  derniere: string | null,
  maintenant: Date,
): Signal[] {
  const commun = {
    kind: 'backup.stale',
    ref: 'backup-status',
    link: '/',
  } as const;
  if (derniere === null) {
    return [
      { ...commun, label: "Aucune sauvegarde réussie n'a été reçue" },
    ];
  }
  const echeance = new Date(new Date(derniere).getTime() + SEUIL_MS);
  if (maintenant.getTime() <= echeance.getTime()) {
    return [];
  }
  return [
    {
      ...commun,
      label: `Dernière sauvegarde réussie il y a plus de ${SEUIL_DE_FRAICHEUR_HEURES} heures`,
      dueOn: aujourdhui(FUSEAU, echeance),
    },
  ];
}
