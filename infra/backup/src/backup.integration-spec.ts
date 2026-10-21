import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Fixture, makeFixture, run } from './run-script';

const SOURCE_CONTAINER = 'personal-os-backup-it';
const SOURCE_PASSWORD = 'mot-de-passe-jetable';
const DB = 'personalos';
const AUTHENTIK_DB = 'authentik';
const PROBE_PORT = '55433';
const AUTHENTIK_PROBE_PORT = '55434';

const S3_CONTAINER = 'personal-os-backup-it-s3';
const S3_IMAGE = 'rclone/rclone:1.75.2';
const S3_BUCKET = 'portfolio';
const CV = '%PDF-1.7 le CV du portfolio';

const SEEDED_ROWS = 3;
const SEEDED_AUTHENTIK_ROWS = 2;

function sh(
  command: string,
  args: string[],
  options: { input?: string; env?: NodeJS.ProcessEnv } = {},
): string {
  return execFileSync(command, args, {
    encoding: 'utf8',
    input: options.input,
    env: options.env ? { ...process.env, ...options.env } : process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function requireTool(tool: string): void {
  try {
    sh('which', [tool]);
  } catch {
    throw new Error(
      `${tool} est absent. La campagne d'intégration exige restic et docker sur la machine.`,
    );
  }
}

function waitFor(condition: () => boolean, echec: string): void {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (condition()) return;
    sh('sleep', ['1']);
  }
  throw new Error(echec);
}

function waitForPostgres(container: string): void {
  waitFor(
    () =>
      sh('docker', ['logs', container]).includes(
        'PostgreSQL init process complete',
      ),
    `${container} n'a pas fini son initialisation`,
  );

  waitFor(() => {
    try {
      sh('docker', [
        'exec',
        container,
        'psql',
        '-U',
        'postgres',
        '-d',
        DB,
        '-c',
        'select 1',
      ]);
      return true;
    } catch {
      return false;
    }
  }, `${container} n'a pas démarré`);
}

/**
 * Lance le script comme le service systemd, avec `PrivateTmp=yes` : son
 * dossier temporaire n'existe que pour lui. Le démon Docker, lui, voit celui de
 * la machine.
 */
function sousPrivateTmp(transit: string): string[] {
  return [
    'unshare',
    '--user',
    '--map-root-user',
    '--mount',
    'sh',
    '-c',
    'mount -t tmpfs none "$1" && TMPDIR="$1" && export TMPDIR && shift && exec "$@"',
    'sh',
    transit,
  ];
}

function removeProbeContainers(): void {
  try {
    const ids = sh('docker', [
      'ps',
      '--all',
      '--quiet',
      '--filter',
      'name=personal-os-restore-',
    ]).trim();
    if (ids) {
      sh('docker', ['rm', '--force', ...ids.split('\n')]);
    }
  } catch {
    // Les conteneurs peuvent déjà avoir été supprimés.
  }
}

describe('sauvegarde et restauration, va-et-vient complet', () => {
  let fixture: Fixture;
  let repoDir: string;
  let restoreDir: string;
  let restoreAuthentikDir: string;

  beforeAll(() => {
    requireTool('docker');
    requireTool('restic');
    try {
      sh('unshare', ['--user', '--map-root-user', '--mount', 'true']);
    } catch {
      throw new Error(
        "unshare --user est refusé : la campagne d'intégration exige les espaces de noms utilisateur (sur Ubuntu, kernel.apparmor_restrict_unprivileged_userns=0).",
      );
    }

    repoDir = mkdtempSync(join(tmpdir(), 'restic-repo-'));
    restoreDir = mkdtempSync(join(tmpdir(), 'restic-restore-'));
    restoreAuthentikDir = mkdtempSync(
      join(tmpdir(), 'restic-restore-authentik-'),
    );

    fixture = makeFixture();
    writeFileSync(
      fixture.envPath,
      [
        `RESTIC_REPOSITORY=${repoDir}`,
        `RESTIC_PASSWORD_FILE=${fixture.passwordPath}`,
      ].join('\n'),
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
      ].join('\n'),
    );

    removeProbeContainers();
    try {
      sh('docker', ['rm', '--force', SOURCE_CONTAINER]);
    } catch {
      // Le conteneur peut déjà être absent.
    }

    sh('docker', [
      'run',
      '--detach',
      '--name',
      SOURCE_CONTAINER,
      '--env',
      `POSTGRES_PASSWORD=${SOURCE_PASSWORD}`,
      '--env',
      `POSTGRES_DB=${DB}`,
      'postgres:18-alpine',
    ]);
    waitForPostgres(SOURCE_CONTAINER);

    sh(
      'docker',
      [
        'exec',
        '--interactive',
        SOURCE_CONTAINER,
        'psql',
        '-U',
        'postgres',
        '-d',
        DB,
      ],
      {
        input: `create table evenement (id serial primary key, titre text not null);
              insert into evenement (titre) values ('un'), ('deux'), ('trois');`,
      },
    );

    sh('restic', ['init'], {
      env: {
        RESTIC_REPOSITORY: repoDir,
        RESTIC_PASSWORD_FILE: fixture.passwordPath,
      },
    });
  });

  afterAll(() => {
    removeProbeContainers();
    for (const conteneur of [SOURCE_CONTAINER, S3_CONTAINER]) {
      try {
        sh('docker', ['rm', '--force', conteneur]);
      } catch {
        // Le conteneur peut déjà être absent.
      }
    }
    for (const dir of [repoDir, restoreDir, restoreAuthentikDir].filter(
      Boolean,
    )) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('crée un instantané exploitable, puis le restaure avec ses données', () => {
    const backup = run('backup.sh', [], fixture);
    expect(backup.status).toBe(0);

    const restore = run(
      'restore.sh',
      ['--target', restoreDir, '--into-postgres', '--read-data', '--keep'],
      fixture,
      { RESTORE_PROBE_PORT: PROBE_PORT },
    );
    if (restore.status !== 0) {
      throw new Error(
        `restore.sh a rendu ${restore.status} :\n${restore.output}`,
      );
    }

    const match = restore.stdout.match(/^dsn: (postgresql:\/\/\S+)$/m);
    expect(match).not.toBeNull();
    const dsn = (match as RegExpMatchArray)[1];

    const count = sh('docker', [
      'run',
      '--rm',
      '--network',
      'host',
      'postgres:18-alpine',
      'psql',
      dsn,
      '--tuples-only',
      '--no-align',
      '--command',
      'select count(*) from evenement',
    ]).trim();

    expect(Number(count)).toBe(SEEDED_ROWS);
  });

  it("emporte la base d'Authentik dans le même instantané, et la rend", () => {
    sh('docker', [
      'exec',
      SOURCE_CONTAINER,
      'createdb',
      '-U',
      'postgres',
      AUTHENTIK_DB,
    ]);
    sh(
      'docker',
      [
        'exec',
        '--interactive',
        SOURCE_CONTAINER,
        'psql',
        '-U',
        'postgres',
        '-d',
        AUTHENTIK_DB,
      ],
      {
        input: `create table authentik_core_user (id serial primary key, username text not null);
                insert into authentik_core_user (username) values ('moi'), ('elle');`,
      },
    );

    writeFileSync(
      fixture.confPath,
      [
        `POSTGRES_CONTAINER=${SOURCE_CONTAINER}`,
        'POSTGRES_USER=postgres',
        `POSTGRES_DB=${DB}`,
        `POSTGRES_DATABASES="${DB} ${AUTHENTIK_DB}"`,
        'BACKUP_PATHS=',
        'KEEP_DAILY=7',
        'KEEP_WEEKLY=4',
        'KEEP_MONTHLY=6',
      ].join('\n'),
    );

    expect(run('backup.sh', [], fixture).status).toBe(0);

    const restore = run(
      'restore.sh',
      [
        '--target',
        restoreAuthentikDir,
        '--into-postgres',
        '--database',
        AUTHENTIK_DB,
        '--keep',
      ],
      fixture,
      { RESTORE_PROBE_PORT: AUTHENTIK_PROBE_PORT },
    );
    if (restore.status !== 0) {
      throw new Error(
        `restore.sh a rendu ${restore.status} :\n${restore.output}`,
      );
    }

    const match = restore.stdout.match(/^dsn: (postgresql:\/\/\S+)$/m);
    expect(match).not.toBeNull();

    const count = sh('docker', [
      'run',
      '--rm',
      '--network',
      'host',
      'postgres:18-alpine',
      'psql',
      (match as RegExpMatchArray)[1],
      '--tuples-only',
      '--no-align',
      '--command',
      'select count(*) from authentik_core_user',
    ]).trim();

    expect(Number(count)).toBe(SEEDED_AUTHENTIK_ROWS);
  });

  it('applique la rétention sans laisser le dépôt grossir indéfiniment', () => {
    expect(run('backup.sh', [], fixture).status).toBe(0);

    const check = sh('restic', ['check', '--read-data'], {
      env: {
        RESTIC_REPOSITORY: repoDir,
        RESTIC_PASSWORD_FILE: fixture.passwordPath,
      },
    });

    expect(check).toContain('no errors were found');
  });

  it('emporte le bucket du stockage objet, même sous le /tmp privé du service', () => {
    try {
      sh('docker', ['rm', '--force', S3_CONTAINER]);
    } catch {
      // Le conteneur peut déjà être absent.
    }
    // Un serveur S3 jetable, dont le bucket contient déjà un CV.
    sh('docker', [
      'run',
      '--detach',
      '--name',
      S3_CONTAINER,
      '--entrypoint',
      'sh',
      S3_IMAGE,
      '-c',
      `mkdir -p /data/${S3_BUCKET}/cv && printf '%s' '${CV}' > /data/${S3_BUCKET}/cv/FR.pdf && exec rclone serve s3 --auth-key cle-de-test,secret-de-test --addr :8080 /data`,
    ]);
    const adresse = sh('docker', [
      'inspect',
      '--format',
      '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}',
      S3_CONTAINER,
    ]).trim();
    const endpoint = `http://${adresse}:8080`;
    waitFor(() => {
      try {
        sh('docker', [
          'exec',
          S3_CONTAINER,
          'wget',
          '-q',
          '-O',
          '/dev/null',
          'http://127.0.0.1:8080/',
        ]);
        return true;
      } catch (erreur) {
        // Une erreur HTTP (requête non signée) prouve que le serveur répond.
        return String((erreur as { stderr?: string }).stderr).includes(
          'server returned error',
        );
      }
    }, "le serveur S3 n'a pas démarré");

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
        `S3_MIRROR_ENDPOINT=${endpoint}`,
        'S3_MIRROR_REGION=gra',
        `S3_MIRROR_BUCKET=${S3_BUCKET}`,
      ].join('\n'),
    );
    writeFileSync(
      fixture.envPath,
      [
        `RESTIC_REPOSITORY=${repoDir}`,
        `RESTIC_PASSWORD_FILE=${fixture.passwordPath}`,
        'S3_MIRROR_ACCESS_KEY_ID=cle-de-test',
        'S3_MIRROR_SECRET_ACCESS_KEY=secret-de-test',
      ].join('\n'),
    );

    const transit = mkdtempSync(join(tmpdir(), 'transit-prive-'));
    try {
      const backup = run('backup.sh', [], fixture, {}, sousPrivateTmp(transit));
      if (backup.status !== 0) {
        throw new Error(
          `backup.sh a rendu ${backup.status} :\n${backup.output}`,
        );
      }
    } finally {
      // Ce que le démon aurait écrit dans le dossier de la machine lui
      // appartient : seul un conteneur peut l'effacer.
      sh('docker', [
        'run',
        '--rm',
        '--volume',
        `${transit}:/transit`,
        '--entrypoint',
        'sh',
        S3_IMAGE,
        '-c',
        'rm -rf /transit/*',
      ]);
      rmSync(transit, { recursive: true, force: true });
    }

    const restic = {
      env: {
        RESTIC_REPOSITORY: repoDir,
        RESTIC_PASSWORD_FILE: fixture.passwordPath,
      },
    };
    const chemin = sh('restic', ['ls', 'latest'], restic)
      .split('\n')
      .find((ligne) => ligne.endsWith('/objets/cv/FR.pdf'));
    expect(chemin).toBeDefined();
    expect(sh('restic', ['dump', 'latest', chemin as string], restic)).toBe(CV);
  });
});
