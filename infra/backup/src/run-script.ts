import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const BIN = resolve(__dirname, '..', 'bin');

export const SECRET = 'mot-de-passe-qui-ne-doit-jamais-fuiter';

export interface Fixture {
  dir: string;
  confPath: string;
  envPath: string;
  passwordPath: string;
}

export interface FixtureOptions {
  conf?: string;
  env?: string;
  passwordMode?: number;
}

export function makeFixture(options: FixtureOptions = {}): Fixture {
  const dir = mkdtempSync(join(tmpdir(), 'personal-os-backup-'));
  const passwordPath = join(dir, 'restic-password');
  const confPath = join(dir, 'backup.conf');
  const envPath = join(dir, 'restic.env');

  writeFileSync(passwordPath, `${SECRET}\n`);
  chmodSync(passwordPath, options.passwordMode ?? 0o600);

  writeFileSync(
    confPath,
    options.conf ??
      [
        'POSTGRES_CONTAINER=personal-os-db',
        'POSTGRES_USER=personalos',
        'POSTGRES_DB=personalos',
        'BACKUP_PATHS="/opt/personal-os/docker-compose.yml"',
        'KEEP_DAILY=7',
        'KEEP_WEEKLY=4',
        'KEEP_MONTHLY=6',
        'BACKUP_HEARTBEAT_URL=',
        'BACKUP_ALERT_EMAIL=',
      ].join('\n')
  );

  writeFileSync(
    envPath,
    options.env ??
      [
        'RESTIC_REPOSITORY=b2:personal-os-restic-test:/',
        `RESTIC_PASSWORD_FILE=${passwordPath}`,
        'B2_ACCOUNT_ID=identifiant-de-test',
        'B2_ACCOUNT_KEY=cle-de-test',
      ].join('\n')
  );

  return { dir, confPath, envPath, passwordPath };
}

export interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
  output: string;
}

export function run(
  script: string,
  args: string[],
  fixture: Fixture,
  extraEnv: NodeJS.ProcessEnv = {}
): RunResult {
  try {
    const stdout = execFileSync(join(BIN, script), args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        BACKUP_CONF: fixture.confPath,
        RESTIC_ENV_FILE: fixture.envPath,
        ...extraEnv,
      },
    });
    return { status: 0, stdout, stderr: '', output: stdout };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    const stdout = failure.stdout ?? '';
    const stderr = failure.stderr ?? '';
    return {
      status: failure.status ?? 1,
      stdout,
      stderr,
      output: stdout + stderr,
    };
  }
}
