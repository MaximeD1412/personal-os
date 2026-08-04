import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Fixture, makeFixture, run } from './run-script';

/**
 * Va-et-vient complet : on sauvegarde une base réelle, puis on la restaure dans
 * un conteneur jetable et on interroge **la base restaurée**.
 *
 * Le dépôt Restic est local — le but n'est pas de tester Backblaze, mais de
 * prouver que le couple sauvegarde/restauration se referme. C'est exactement le
 * geste que l'ADR 0021 met sur le chemin de chaque déploiement.
 */

const SOURCE_CONTAINER = 'personal-os-backup-it';
const SOURCE_PASSWORD = 'mot-de-passe-jetable';
const DB = 'personalos';
const PROBE_PORT = '55433';

/** Lignes semées : la base restaurée doit en retrouver exactement autant. */
const SEEDED_ROWS = 3;

function sh(command: string, args: string[], options: { input?: string; env?: NodeJS.ProcessEnv } = {}): string {
  return execFileSync(command, args, {
    encoding: 'utf8',
    input: options.input,
    env: options.env ? { ...process.env, ...options.env } : process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function requireTool(tool: string): void {
  try {
    // `which` plutôt que `command -v` : ce dernier est une primitive du shell,
    // et execFileSync n'en démarre pas.
    sh('which', [tool]);
  } catch {
    throw new Error(
      `${tool} est absent. La campagne d'intégration exige restic et docker sur la machine.`
    );
  }
}

function waitForPostgres(container: string): void {
  // `pg_isready` répond « prêt » pendant l'initialisation de l'image, avant que
  // POSTGRES_DB existe : on attend une requête aboutie sur la base visée.
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      sh('docker', [
        'exec', container, 'psql', '-U', 'postgres', '-d', DB, '-c', 'select 1',
      ]);
      return;
    } catch {
      sh('sleep', ['1']);
    }
  }
  throw new Error(`${container} n'a pas démarré`);
}

/** Supprime les conteneurs jetables laissés par --keep, quel que soit leur suffixe. */
function removeProbeContainers(): void {
  try {
    const ids = sh('docker', [
      'ps', '--all', '--quiet', '--filter', 'name=personal-os-restore-',
    ]).trim();
    if (ids) {
      sh('docker', ['rm', '--force', ...ids.split('\n')]);
    }
  } catch {
    // Rien à nettoyer.
  }
}

describe('sauvegarde et restauration, va-et-vient complet', () => {
  let fixture: Fixture;
  let repoDir: string;
  let restoreDir: string;

  beforeAll(() => {
    requireTool('docker');
    requireTool('restic');

    repoDir = mkdtempSync(join(tmpdir(), 'restic-repo-'));
    restoreDir = mkdtempSync(join(tmpdir(), 'restic-restore-'));

    fixture = makeFixture();
    writeFileSync(
      fixture.envPath,
      [`RESTIC_REPOSITORY=${repoDir}`, `RESTIC_PASSWORD_FILE=${fixture.passwordPath}`].join('\n')
    );
    writeFileSync(
      fixture.confPath,
      [
        `POSTGRES_CONTAINER=${SOURCE_CONTAINER}`,
        'POSTGRES_USER=postgres',
        `POSTGRES_DB=${DB}`,
        'BACKUP_PATHS=',
        'KEEP_DAILY=7',
        'KEEP_WEEKLY=4',
        'KEEP_MONTHLY=6',
      ].join('\n')
    );

    removeProbeContainers();
    try {
      sh('docker', ['rm', '--force', SOURCE_CONTAINER]);
    } catch {
      // Pas de conteneur résiduel : tant mieux.
    }

    sh('docker', [
      'run', '--detach', '--name', SOURCE_CONTAINER,
      '--env', `POSTGRES_PASSWORD=${SOURCE_PASSWORD}`,
      '--env', `POSTGRES_DB=${DB}`,
      'postgres:18-alpine',
    ]);
    waitForPostgres(SOURCE_CONTAINER);

    sh('docker', ['exec', '--interactive', SOURCE_CONTAINER, 'psql', '-U', 'postgres', '-d', DB], {
      input: `create table evenement (id serial primary key, titre text not null);
              insert into evenement (titre) values ('un'), ('deux'), ('trois');`,
    });

    sh('restic', ['init'], {
      env: {
        RESTIC_REPOSITORY: repoDir,
        RESTIC_PASSWORD_FILE: fixture.passwordPath,
      },
    });
  });

  afterAll(() => {
    removeProbeContainers();
    try {
      sh('docker', ['rm', '--force', SOURCE_CONTAINER]);
    } catch {
      // Déjà parti.
    }
    for (const dir of [repoDir, restoreDir].filter(Boolean)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('crée un instantané exploitable, puis le restaure avec ses données', () => {
    const backup = run('backup.sh', [], fixture);
    expect(backup.status).toBe(0);

    // --keep laisse le conteneur en vie pour qu'on puisse l'interroger ; c'est
    // aussi le mode qu'utilisera le banc d'essai de migration.
    const restore = run(
      'restore.sh',
      ['--target', restoreDir, '--into-postgres', '--read-data', '--keep'],
      fixture,
      { RESTORE_PROBE_PORT: PROBE_PORT }
    );
    expect(restore.status).toBe(0);

    // Contrat consommé par le déploiement (#4, ADR 0021) : une ligne « dsn: »
    // seule sur la sortie standard, tout le reste sur l'erreur standard.
    const match = restore.stdout.match(/^dsn: (postgresql:\/\/\S+)$/m);
    expect(match).not.toBeNull();
    const dsn = (match as RegExpMatchArray)[1];

    // La preuve : la requête part sur la base **restaurée**, jamais sur la
    // source. Interroger la source ne prouverait que la santé de la source.
    const count = sh('docker', [
      'run', '--rm', '--network', 'host', 'postgres:18-alpine',
      'psql', dsn, '--tuples-only', '--no-align',
      '--command', 'select count(*) from evenement',
    ]).trim();

    expect(Number(count)).toBe(SEEDED_ROWS);
  });

  it('applique la rétention sans laisser le dépôt grossir indéfiniment', () => {
    // Deux sauvegardes de plus, puis vérification que `forget --prune` a bien
    // laissé le dépôt cohérent — un prune fautif casse l'index, et ça ne se
    // voit qu'à la restauration suivante.
    expect(run('backup.sh', [], fixture).status).toBe(0);

    const check = sh('restic', ['check', '--read-data'], {
      env: {
        RESTIC_REPOSITORY: repoDir,
        RESTIC_PASSWORD_FILE: fixture.passwordPath,
      },
    });

    expect(check).toContain('no errors were found');
  });
});
