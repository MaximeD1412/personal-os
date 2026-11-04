import type { Semeur } from './seeder';

/**
 * L'état des sauvegardes du staging : une sauvegarde réussie cette nuit, à
 * l'heure du timer de production (03:30). Le staging n'a pas d'agent de
 * sauvegarde ; sans cette rangée, son Accueil n'aurait rien à montrer. Il la
 * voit vieillir, et passer en retard s'il n'est pas redéployé dans les
 * 26 heures, comme la production.
 */
export const backup: Semeur = {
  module: 'backup',
  modeles: ['BackupStatus'],
  // Hors Espace : les sauvegardes sont celles de la machine.
  espaces: [],
  async semer(prisma, demo) {
    const nuit = demo.le(0, '03:30');
    await prisma.backupStatus.create({
      data: { lastSuccessAt: nuit, lastRunAt: nuit, lastError: null },
    });
    return 1;
  },
};
