import { createHash } from 'node:crypto';
import { PrismaService } from '../lib/prisma.service';
import {
  comptesDeDemo,
  refuserLaProduction,
  type Environnement,
} from './environment';

/**
 * La Session de capture : celle que `scripts/captures.sh` pose dans le
 * navigateur pour photographier le tableau de bord, qui n'a aucun écran sans
 * session (ADR 0026), sans passer par Authentik. Elle appartient au premier
 * Compte de `DEMO_ACCOUNT_EMAILS` et n'existe que le temps de la capture :
 * le script la supprime en sortant, et sa courte durée de vie la rend
 * inutilisable si la suppression n'a pas eu lieu (processus tué).
 *
 * Aucune route de l'API ne l'émet : elle s'écrit directement en base, comme
 * l'API écrit les siennes (`packages/api/src/app/auth/auth.service.ts`).
 */
const DUREE_DE_VIE_MS = 30 * 60 * 1000;

const RAISON =
  "la Session de capture ouvre le tableau de bord sans passer par Authentik, elle n'est jamais créée en production";

/** Un jeton d'au moins 32 octets tirés au hasard, en base64url. */
const JETON = /^[A-Za-z0-9_-]{43,}$/;

/**
 * Le jeton est tiré par l'appelant, avant que la Session n'existe : il sait
 * ainsi toujours quoi fermer, même interrompu pendant l'ouverture. C'est la
 * valeur du cookie `pos_session` ; seule son empreinte est écrite en base.
 */
export async function ouvrirLaSessionDeCapture(
  prisma: PrismaService,
  env: Environnement,
  token: string,
  maintenant = new Date(),
): Promise<void> {
  refuserLaProduction(env, RAISON);
  if (!JETON.test(token)) {
    throw new Error(
      'Le jeton de la Session de capture doit compter au moins 32 octets aléatoires, en base64url.',
    );
  }
  const [email] = comptesDeDemo(env);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) {
    throw new Error(
      `Le Compte de démo ${email} n'existe pas encore : lance d'abord \`pnpm demo:seed\`.`,
    );
  }

  await prisma.session.create({
    data: {
      tokenHash: empreinte(token),
      userId: user.id,
      expiresAt: new Date(maintenant.getTime() + DUREE_DE_VIE_MS),
    },
  });
}

/** Supprime la Session de ce jeton, si elle existe encore. */
export async function fermerLaSessionDeCapture(
  prisma: PrismaService,
  token: string,
): Promise<void> {
  await prisma.session.deleteMany({ where: { tokenHash: empreinte(token) } });
}

/** L'empreinte que la garde de l'API compare (`auth.service.ts`). */
function empreinte(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * `session.ts ouvrir` et `session.ts fermer` lisent le jeton sur l'entrée
 * standard : il n'apparaît ni dans les arguments ni dans l'environnement d'un
 * processus. La production est refusée avant toute connexion à la base.
 */
async function lancer(
  [commande]: readonly string[],
  env: NodeJS.ProcessEnv,
): Promise<void> {
  refuserLaProduction(env, RAISON);
  if (commande !== 'ouvrir' && commande !== 'fermer') {
    throw new Error('Usage : session.ts ouvrir|fermer < jeton');
  }
  const token = (await lireLEntree()).trim();

  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    if (commande === 'ouvrir') {
      await ouvrirLaSessionDeCapture(prisma, env, token);
    } else {
      await fermerLaSessionDeCapture(prisma, token);
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function lireLEntree(): Promise<string> {
  let texte = '';
  for await (const bloc of process.stdin) {
    texte += String(bloc);
  }
  return texte;
}

if (require.main === module) {
  lancer(process.argv.slice(2), process.env).catch((erreur: unknown) => {
    console.error(erreur instanceof Error ? erreur.message : erreur);
    process.exitCode = 1;
  });
}
