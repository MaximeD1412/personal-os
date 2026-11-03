import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { PrismaService } from '../lib/prisma.service';

const RACINE = resolve(__dirname, '../../../..');
const executer = promisify(execFile);

/**
 * La commande telle que `pnpm demo:seed` la lance : on la relit dans la cible
 * Nx plutôt que de la recopier, pour éprouver celle-là et pas une autre.
 */
function commandeDuSemis(): string {
  const projet = JSON.parse(
    readFileSync(resolve(RACINE, 'packages/database/project.json'), 'utf8'),
  ) as { targets: Record<string, { options: { command: string } }> };
  return projet.targets['demo-seed'].options.command;
}

/**
 * L'exécuteur Jest de Nx pose `TS_NODE_COMPILER_OPTIONS` pour ses propres
 * besoins : la commande ne le rencontre jamais quand on la lance, on le retire.
 */
function environnementDeLaCommande(
  env: Record<string, string>,
): NodeJS.ProcessEnv {
  const herite = Object.fromEntries(
    Object.entries(process.env).filter(([nom]) => !nom.startsWith('TS_NODE_')),
  );
  return { ...herite, ...env };
}

async function lancer(
  env: Record<string, string>,
): Promise<{ code: number; sortie: string; erreurs: string }> {
  try {
    const { stdout, stderr } = await executer('sh', ['-c', commandeDuSemis()], {
      cwd: RACINE,
      env: environnementDeLaCommande(env),
    });
    return { code: 0, sortie: stdout, erreurs: stderr };
  } catch (echec) {
    const { code, stdout, stderr } = echec as {
      code: number;
      stdout: string;
      stderr: string;
    };
    return { code, sortie: stdout, erreurs: stderr };
  }
}

describe('pnpm demo:seed', () => {
  const COMPTES = 'a@commande.test,b@commande.test';
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('refuse explicitement de tourner avec APP_ENV=production, sans toucher à la base', async () => {
    const resultat = await lancer({
      APP_ENV: 'production',
      DEMO_ACCOUNT_EMAILS: COMPTES,
    });

    expect(resultat.code).not.toBe(0);
    expect(resultat.erreurs).toContain('APP_ENV vaut « production »');
    expect(
      await prisma.user.count({
        where: { email: { endsWith: '@commande.test' } },
      }),
    ).toBe(0);
  });

  it('sème, et donne le même bilan deux fois de suite', async () => {
    const premier = await lancer({
      APP_ENV: 'staging',
      DEMO_ACCOUNT_EMAILS: COMPTES,
    });
    const second = await lancer({
      APP_ENV: 'staging',
      DEMO_ACCOUNT_EMAILS: COMPTES,
    });

    expect(premier).toMatchObject({ code: 0, erreurs: '' });
    expect(premier.sortie).toMatch(/calendar : \d+/);
    expect(second.sortie).toBe(premier.sortie);
    expect(
      await prisma.user.count({
        where: { email: { endsWith: '@commande.test' } },
      }),
    ).toBe(2);
  });
});
