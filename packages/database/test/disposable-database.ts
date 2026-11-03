import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { Client } from 'pg';

const RACINE = resolve(__dirname, '../../..');

/**
 * La base jetable des tests d'intégration du paquet, sur le modèle de celle de
 * l'API (`packages/api/test/disposable-database.ts`) : chaque exécution crée la
 * sienne, si bien que plusieurs worktrees testent en même temps.
 */
export function urlDeLaBase(base: string, nom: string): string {
  const url = new URL(base);
  url.pathname = `/${nom}`;
  return url.toString();
}

async function enAdministrateur(
  base: string,
  action: (client: Client) => Promise<void>,
): Promise<void> {
  const url = new URL(base);
  url.pathname = '/postgres';
  url.search = '';
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  try {
    await action(client);
  } finally {
    await client.end();
  }
}

export async function creerLaBase(base: string, nom: string): Promise<void> {
  await enAdministrateur(base, async (client) => {
    await client.query(`DROP DATABASE IF EXISTS "${nom}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${nom}"`);
  });
}

export async function supprimerLaBase(
  base: string,
  nom: string,
): Promise<void> {
  await enAdministrateur(base, async (client) => {
    await client.query(`DROP DATABASE IF EXISTS "${nom}" WITH (FORCE)`);
  });
}

export function migrerLaBase(url: string): void {
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: RACINE,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}
