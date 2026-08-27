import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  attendreInitPostgres,
  clonerDepot,
  commettreStack,
  creerDepot,
  demarrerRegistre,
  Depot,
  promouvoir,
  publierImage,
  Registre,
  requireTool,
  sh,
  silence,
  SOURCE_ROOT,
} from './livraison';
import { Fixture, run } from './run-script';

const REGISTRE_CONTENEUR = 'personal-os-deploy-it-registry';
const REGISTRE_PORT = 5088;
const DB_CONTENEUR = 'personal-os-deploy-it-db';
const API_CONTENEUR = 'personal-os-deploy-it-api';
const PROJET = 'personal-os-deploy-it';
const APP_PORT = 18088;
const REPETITION_PORT = 55488;
const MOT_DE_PASSE = 'mot-de-passe-jetable';

const SANTE_URL = `http://127.0.0.1:${APP_PORT}/api/health`;
const BACKUP_BIN = resolve(SOURCE_ROOT, '..', 'backup', 'bin');

const LIGNES_SEMEES = 3;

function compose(marque: string): string {
  return [
    `# ${marque}`,
    'services:',
    '  db:',
    '    image: postgres:18-alpine',
    `    container_name: ${DB_CONTENEUR}`,
    '    environment:',
    '      POSTGRES_USER: postgres',
    '      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}',
    '      POSTGRES_DB: personalos',
    '    healthcheck:',
    "      test: ['CMD-SHELL', 'pg_isready -U postgres -d personalos']",
    '      interval: 2s',
    '      timeout: 3s',
    '      retries: 30',
    '  api:',
    '    image: ${REGISTRY}/api:${IMAGE_TAG}',
    `    container_name: ${API_CONTENEUR}`,
    '    depends_on:',
    '      db:',
    '        condition: service_healthy',
    '    environment:',
    '      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@db:5432/personalos',
    '    ports:',
    "      - '127.0.0.1:${APP_PORT}:80'",
    '',
  ].join('\n');
}

describe('déploiement tiré, de bout en bout', () => {
  let racine: string;
  let registre: Registre;
  let depot: Depot;
  let fixture: Fixture;
  let environnement: NodeJS.ProcessEnv;
  let composePath: string;
  let statePath: string;
  let historyPath: string;

  let revisionSaine: string;
  let revisionMalade: string;
  let revisionRefusee: string;

  function requeteProduction(sql: string): string {
    return sh('docker', [
      'exec', '--env', `PGPASSWORD=${MOT_DE_PASSE}`, DB_CONTENEUR,
      'psql', '--username', 'postgres', '--dbname', 'personalos',
      '--tuples-only', '--no-align', '--command', sql,
    ]).trim();
  }

  function imageEnPlace(): string {
    return sh('docker', ['inspect', '--format', '{{.Config.Image}}', API_CONTENEUR]).trim();
  }

  function etat(clef: string): string {
    const ligne = readFileSync(statePath, 'utf8')
      .split('\n')
      .find((l) => l.startsWith(`${clef}=`));
    return ligne ? ligne.slice(clef.length + 1) : '';
  }

  function sante(): number {
    try {
      return Number(
        sh('curl', ['--silent', '--output', '/dev/null', '--write-out', '%{http_code}', SANTE_URL])
      );
    } catch {
      return 0;
    }
  }

  function deployer(args: string[] = []) {
    return run('deploy.sh', args, fixture, environnement);
  }

  beforeAll(() => {
    for (const outil of ['docker', 'restic', 'git', 'curl']) {
      requireTool(outil);
    }

    racine = mkdtempSync(join(tmpdir(), 'personal-os-livraison-'));

    depot = creerDepot(racine);
    revisionSaine = commettreStack(depot, compose('version saine'), 'pile initiale');
    revisionMalade = commettreStack(depot, compose('version sans sonde'), 'pile sans sonde');
    revisionRefusee = commettreStack(depot, compose('version refusee'), 'pile refusée');
    clonerDepot(depot);

    registre = demarrerRegistre(REGISTRE_CONTENEUR, REGISTRE_PORT);

    publierImage(
      registre,
      revisionSaine,
      {
        migration:
          'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "create table if not exists migration_v1 (id serial primary key)"',
        sante: true,
      },
      join(racine, 'image-saine')
    );
    publierImage(
      registre,
      revisionMalade,
      {
        migration:
          'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "create table if not exists migration_v2 (id serial primary key)"',
        sante: false,
      },
      join(racine, 'image-malade')
    );
    publierImage(
      registre,
      revisionRefusee,
      {
        migration:
          'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "alter table table_absente add column x int"',
        sante: true,
      },
      join(racine, 'image-refusee')
    );

    const depotRestic = join(racine, 'restic');
    const clePath = join(racine, 'restic-password');
    const backupConf = join(racine, 'backup.conf');
    const resticEnv = join(racine, 'restic.env');

    writeFileSync(clePath, 'cle-jetable\n');
    chmodSync(clePath, 0o600);
    mkdirSync(depotRestic, { recursive: true });
    writeFileSync(
      backupConf,
      [
        `POSTGRES_CONTAINER=${DB_CONTENEUR}`,
        'POSTGRES_USER=postgres',
        'POSTGRES_DB=personalos',
        'BACKUP_PATHS=',
        'KEEP_DAILY=7',
        'KEEP_WEEKLY=4',
        'KEEP_MONTHLY=6',
      ].join('\n')
    );
    writeFileSync(
      resticEnv,
      [`RESTIC_REPOSITORY=${depotRestic}`, `RESTIC_PASSWORD_FILE=${clePath}`].join('\n')
    );
    sh('restic', ['init'], {
      env: { RESTIC_REPOSITORY: depotRestic, RESTIC_PASSWORD_FILE: clePath },
    });

    composePath = join(racine, 'docker-compose.yml');
    statePath = join(racine, 'deploy-state');
    historyPath = join(racine, 'deploy.log');
    const stackEnv = join(racine, 'stack.env');
    const deployConf = join(racine, 'deploy.conf');
    const ghcrEnv = join(racine, 'ghcr.env');

    writeFileSync(composePath, compose('version saine'));
    writeFileSync(
      stackEnv,
      [`POSTGRES_PASSWORD=${MOT_DE_PASSE}`, `APP_PORT=${APP_PORT}`].join('\n')
    );
    writeFileSync(ghcrEnv, '');
    writeFileSync(
      deployConf,
      [
        `REGISTRY=${registre.prefixe}`,
        'IMAGES="api"',
        'CHANNEL_TAG=main',
        'CHANNEL_IMAGE=api',
        `COMPOSE_FILE=${composePath}`,
        `COMPOSE_ENV_FILE=${stackEnv}`,
        `COMPOSE_PROJECT=${PROJET}`,
        `CADDY_DIR=${join(racine, 'caddy')}`,
        `SOURCE_CHECKOUT=${depot.clone}`,
        `DEPLOY_PREFIX=${SOURCE_ROOT}`,
        'MIGRATE_SERVICE=api',
        'MIGRATE_COMMAND="/migrate.sh"',
        `RESTORE_SCRIPT=${join(BACKUP_BIN, 'restore.sh')}`,
        `REHEARSAL_TARGET=${join(racine, 'repetition')}`,
        `REHEARSAL_PROBE_PORT=${REPETITION_PORT}`,
        `HEALTH_URL=${SANTE_URL}`,
        'HEALTH_RETRIES=8',
        'HEALTH_DELAY=1',
        `DEPLOY_STATE_FILE=${statePath}`,
        `DEPLOY_HISTORY_FILE=${historyPath}`,
        'DEPLOY_HEARTBEAT_URL=',
        'DEPLOY_ALERT_EMAIL=',
      ].join('\n')
    );

    fixture = {
      dir: racine,
      confPath: deployConf,
      envPath: ghcrEnv,
      composePath,
      statePath,
      historyPath,
      restorePath: join(BACKUP_BIN, 'restore.sh'),
    };
    environnement = { BACKUP_CONF: backupConf, RESTIC_ENV_FILE: resticEnv };

    nettoyerPile();
    sh('docker', [
      'compose', '--file', composePath, '--env-file', stackEnv,
      '--project-name', PROJET, 'up', '--detach', '--wait', 'db',
    ], {
      env: { REGISTRY: registre.prefixe, IMAGE_TAG: revisionSaine },
    });

    attendreInitPostgres(DB_CONTENEUR);

    sh('docker', ['exec', '--interactive', '--env', `PGPASSWORD=${MOT_DE_PASSE}`, DB_CONTENEUR,
      'psql', '--username', 'postgres', '--dbname', 'personalos'], {
      input: `create table evenement (id serial primary key, titre text not null);
              insert into evenement (titre) values ('un'), ('deux'), ('trois');`,
    });

    sh(join(BACKUP_BIN, 'backup.sh'), [], {
      env: { BACKUP_CONF: backupConf, RESTIC_ENV_FILE: resticEnv },
    });
  });

  function nettoyerPile(): void {
    silence(() =>
      sh('docker', [
        'compose', '--file', composePath, '--project-name', PROJET,
        'down', '--volumes', '--remove-orphans',
      ], { env: { REGISTRY: registre.prefixe, IMAGE_TAG: revisionSaine, POSTGRES_PASSWORD: MOT_DE_PASSE, APP_PORT: String(APP_PORT) } })
    );
    silence(() => sh('docker', ['rm', '--force', DB_CONTENEUR]));
    silence(() => sh('docker', ['rm', '--force', API_CONTENEUR]));
    const restes = silenceur(() =>
      sh('docker', ['ps', '--all', '--quiet', '--filter', 'name=personal-os-restore-']).trim()
    );
    if (restes) {
      silence(() => sh('docker', ['rm', '--force', ...restes.split('\n')]));
    }
  }

  function silenceur(action: () => string): string {
    try {
      return action();
    } catch {
      return '';
    }
  }

  afterAll(() => {
    if (!racine) return;
    nettoyerPile();
    silence(() => sh('docker', ['rm', '--force', REGISTRE_CONTENEUR]));
    for (const revision of [revisionSaine, revisionMalade, revisionRefusee].filter(Boolean)) {
      silence(() => sh('docker', ['rmi', '--force', `${registre.prefixe}/api:${revision}`]));
    }
    rmSync(racine, { recursive: true, force: true });
  });

  it('détecte la version du canal et l’applique sans qu’on la lui donne', () => {
    promouvoir(registre, revisionSaine);

    const resultat = deployer();

    expect(resultat.status).toBe(0);
    expect(etat('DEPLOYED_REVISION')).toBe(revisionSaine);
    expect(imageEnPlace()).toBe(`${registre.prefixe}/api:${revisionSaine}`);
    expect(sante()).toBe(200);

    expect(requeteProduction("select to_regclass('public.migration_v1') is not null")).toBe('t');
    expect(readFileSync(historyPath, 'utf8')).toContain(`succes\t${revisionSaine}`);

    const journal = resultat.stderr;
    expect(journal.indexOf('démarrage de la base')).toBeLessThan(
      journal.indexOf('migration réelle')
    );
  });

  it('arrête le déploiement quand la migration échoue sur la restauration', () => {
    promouvoir(registre, revisionRefusee);

    const resultat = deployer();

    expect(resultat.status).not.toBe(0);
    expect(resultat.stderr).toContain('production intacte');

    expect(imageEnPlace()).toBe(`${registre.prefixe}/api:${revisionSaine}`);
    expect(sante()).toBe(200);
    expect(etat('DEPLOYED_REVISION')).toBe(revisionSaine);
    expect(etat('FAILED_REVISION')).toBe(revisionRefusee);
    expect(requeteProduction('select count(*) from evenement')).toBe(String(LIGNES_SEMEES));
  });

  it('ne représente pas au banc d’essai une révision déjà refusée', () => {
    const resultat = deployer();

    expect(resultat.status).toBe(0);
    expect(resultat.stderr).toContain('déjà en échec');
  });

  it('revient aux images précédentes quand la santé échoue, sans toucher la base', () => {
    sh('docker', ['exec', '--env', `PGPASSWORD=${MOT_DE_PASSE}`, DB_CONTENEUR,
      'psql', '--username', 'postgres', '--dbname', 'personalos',
      '--command', "insert into evenement (titre) values ('saisi entre deux versions')"]);

    promouvoir(registre, revisionMalade);

    const resultat = deployer();

    expect(resultat.status).not.toBe(0);
    expect(resultat.stderr).toContain('retour arrière effectué');

    expect(imageEnPlace()).toBe(`${registre.prefixe}/api:${revisionSaine}`);
    expect(sante()).toBe(200);
    expect(etat('DEPLOYED_REVISION')).toBe(revisionSaine);
    expect(etat('FAILED_REVISION')).toBe(revisionMalade);

    expect(requeteProduction("select to_regclass('public.migration_v2') is not null")).toBe('t');
    expect(requeteProduction('select count(*) from evenement')).toBe(String(LIGNES_SEMEES + 1));
  });

  it('laisse une trace même là où rien ne prévoyait d’échouer', () => {
    const muet = join(racine, 'restore-muet.sh');
    writeFileSync(muet, '#!/usr/bin/env bash\necho "rien a dire" >&2\n');
    chmodSync(muet, 0o755);

    const confMuette = join(racine, 'deploy-muet.conf');
    writeFileSync(
      confMuette,
      readFileSync(fixture.confPath, 'utf8').replace(
        /^RESTORE_SCRIPT=.*$/m,
        `RESTORE_SCRIPT=${muet}`
      )
    );

    const avant = readFileSync(historyPath, 'utf8');
    const resultat = run('deploy.sh', ['--revision', revisionRefusee, '--force'], fixture, {
      ...environnement,
      DEPLOY_CONF: confMuette,
    });

    expect(resultat.status).not.toBe(0);
    expect(resultat.stderr).toContain('contrat rompu');

    const ajout = readFileSync(historyPath, 'utf8').slice(avant.length);
    expect(ajout).toContain(`echec-inattendu\t${revisionRefusee}`);
    expect(etat('FAILED_REVISION')).toBe(revisionRefusee);

    expect(imageEnPlace()).toBe(`${registre.prefixe}/api:${revisionSaine}`);
    expect(sante()).toBe(200);
  });
});
