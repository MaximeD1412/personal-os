import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const BIN = resolve(__dirname, '..', 'bin');

/** Jeton factice : sa présence dans une sortie est une fuite. */
export const SECRET = 'jeton-ghcr-qui-ne-doit-jamais-fuiter';

export interface Fixture {
  dir: string;
  confPath: string;
  envPath: string;
  composePath: string;
  statePath: string;
  historyPath: string;
  restorePath: string;
}

export interface FixtureOptions {
  /** Lignes ajoutées au deploy.conf, après les valeurs par défaut. */
  extraConf?: string;
  /** Contenu du script de restauration factice. Vide = script absent. */
  restoreScript?: string | null;
  /** Contenu du fichier d'état. Absent = aucune version déployée. */
  state?: string;
}

/**
 * Pose une configuration jetable dans un répertoire temporaire.
 *
 * Les scripts lisent leurs chemins depuis DEPLOY_CONF et GHCR_ENV_FILE, ce qui
 * permet de les exercer sans jamais toucher /etc ni /opt.
 */
export function makeFixture(options: FixtureOptions = {}): Fixture {
  const dir = mkdtempSync(join(tmpdir(), 'personal-os-deploy-'));
  const confPath = join(dir, 'deploy.conf');
  const envPath = join(dir, 'ghcr.env');
  const composePath = join(dir, 'docker-compose.yml');
  const stackEnvPath = join(dir, 'stack.env');
  const statePath = join(dir, 'deploy-state');
  const historyPath = join(dir, 'deploy.log');
  const restorePath = join(dir, 'restore.sh');
  const checkoutPath = join(dir, 'src');

  writeFileSync(composePath, 'services: {}\n');
  writeFileSync(stackEnvPath, 'POSTGRES_USER=personalos\n');

  if (options.restoreScript !== null) {
    writeFileSync(
      restorePath,
      options.restoreScript ?? '#!/usr/bin/env bash\necho "dsn: postgresql://x@localhost:1/y"\n'
    );
    chmodSync(restorePath, 0o755);
  }

  if (options.state !== undefined) {
    writeFileSync(statePath, options.state);
  }

  writeFileSync(
    confPath,
    [
      'REGISTRY=ghcr.io/exemple/personal-os',
      'IMAGES="api dashboard portfolio"',
      'CHANNEL_TAG=main',
      'CHANNEL_IMAGE=api',
      `COMPOSE_FILE=${composePath}`,
      `COMPOSE_ENV_FILE=${stackEnvPath}`,
      'COMPOSE_PROJECT=personal-os-test',
      `CADDY_DIR=${join(dir, 'caddy')}`,
      `SOURCE_CHECKOUT=${checkoutPath}`,
      `DEPLOY_PREFIX=${join(dir, 'agent')}`,
      'MIGRATE_SERVICE=api',
      'MIGRATE_COMMAND="node_modules/.bin/prisma migrate deploy"',
      `RESTORE_SCRIPT=${restorePath}`,
      `REHEARSAL_TARGET=${join(dir, 'repetition')}`,
      'HEALTH_URL=http://127.0.0.1:3001/api/health',
      'HEALTH_RETRIES=3',
      'HEALTH_DELAY=1',
      `DEPLOY_STATE_FILE=${statePath}`,
      `DEPLOY_HISTORY_FILE=${historyPath}`,
      'DEPLOY_HEARTBEAT_URL=',
      'DEPLOY_ALERT_EMAIL=',
      options.extraConf ?? '',
    ].join('\n')
  );

  writeFileSync(envPath, ['GHCR_USERNAME=exemple', `GHCR_TOKEN=${SECRET}`].join('\n'));

  return { dir, confPath, envPath, composePath, statePath, historyPath, restorePath };
}

export interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
  /** Sortie standard et erreur réunies : pratique pour chercher une fuite. */
  output: string;
}

/**
 * Exécute un script du répertoire bin/ contre une configuration jetable.
 *
 * `spawnSync` plutôt qu'`execFileSync` : l'agent dit sur l'erreur standard ce
 * qu'il a décidé de **ne pas** faire — « déjà en place », « déjà en échec » — et
 * il rend 0 en le disant. Un harnais qui ne relit l'erreur standard qu'en cas
 * d'échec ne verrait jamais ces refus.
 */
export function run(
  script: string,
  args: string[],
  fixture: Fixture,
  extraEnv: NodeJS.ProcessEnv = {}
): RunResult {
  const result = spawnSync(join(BIN, script), args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      DEPLOY_CONF: fixture.confPath,
      GHCR_ENV_FILE: fixture.envPath,
      ...extraEnv,
    },
  });

  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  return { status: result.status ?? 1, stdout, stderr, output: stdout + stderr };
}
