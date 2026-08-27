import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { Client } from 'pg';

const WORKSPACE_ROOT = resolve(__dirname, '../../..');

export function disposableDatabaseUrl(baseUrl: string, name: string): string {
  const url = new URL(baseUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

export function adminUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.pathname = '/postgres';
  url.search = '';
  return url.toString();
}

async function withAdminClient(
  baseUrl: string,
  run: (client: Client) => Promise<void>,
): Promise<void> {
  const client = new Client({ connectionString: adminUrl(baseUrl) });
  await client.connect();
  try {
    await run(client);
  } finally {
    await client.end();
  }
}

export async function createDatabase(
  baseUrl: string,
  name: string,
): Promise<void> {
  await withAdminClient(baseUrl, async (client) => {
    await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${name}"`);
  });
}

export async function dropDatabase(
  baseUrl: string,
  name: string,
): Promise<void> {
  await withAdminClient(baseUrl, async (client) => {
    await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  });
}

export function migrateDatabase(databaseUrl: string): void {
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: WORKSPACE_ROOT,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}
