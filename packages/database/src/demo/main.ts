import { PrismaService } from '../lib/prisma.service';
import { comptesDeDemo, refuserLaProduction } from './environnement';
import { semer } from './semis';

/**
 * `pnpm demo:seed` : remet la base désignée par `DATABASE_URL` dans l'état du
 * jeu de démo. Les vérifications d'environnement passent avant la connexion :
 * en production, la commande s'arrête sans avoir touché à la base.
 */
async function lancer(env: NodeJS.ProcessEnv): Promise<void> {
  refuserLaProduction(env);
  const comptes = comptesDeDemo(env);

  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const bilan = await semer(prisma, comptes);
    console.log(
      `Jeu de démo semé pour le ${bilan.aujourdhui} (${comptes.join(', ')}) :`,
    );
    for (const { module, rangees } of bilan.modules) {
      console.log(`  ${module} : ${rangees}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

lancer(process.env).catch((erreur: unknown) => {
  console.error(erreur instanceof Error ? erreur.message : erreur);
  process.exitCode = 1;
});
