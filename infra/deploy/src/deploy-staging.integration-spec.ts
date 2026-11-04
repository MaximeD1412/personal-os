import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  clonerDepot,
  creerDepot,
  demarrerRegistre,
  Depot,
  portsPris,
  Registre,
  requireTool,
  sh,
  silence,
  SOURCE_ROOT,
} from './livraison';
import { Fixture, run } from './run-script';

/**
 * Le staging de démonstration, de bout en bout, avec le **vrai**
 * docker-compose.staging.yml : ses plafonds, son réseau partagé, son alias de
 * base. Les images sont des doubles (un httpd, psql) qui jouent la vérification,
 * la migration et le semis par des scripts.
 *
 * À côté tourne un projet compose qui tient le rôle de la prod : le staging ne
 * doit toucher à aucun de ses conteneurs.
 *
 * Noms et ports à elle, distincts de ceux de deploy.integration-spec.ts.
 */
const REGISTRE_CONTENEUR = 'personal-os-deploy-staging-it-registry';
const REGISTRE_PORT = 5089;
const PROJET_STAGING = 'personal-os-deploy-staging-it';
const PROJET_PROD = 'personal-os-deploy-staging-it-prod';
const RESEAU = 'personal-os-deploy-staging-it-edge';
const API_PORT = 18188;
const MOT_DE_PASSE = 'mot-de-passe-jetable';

const SANTE_URL = `http://127.0.0.1:${API_PORT}/api/health`;
const LIGNES_DE_DEMO = ['annonce', 'séance', 'recette'];

/** Les plafonds du vrai fichier, tels que Docker les applique. */
const PLAFONDS: Record<string, { nanoCpus: number; memoire: number }> = {
  db: { nanoCpus: 300_000_000, memoire: 320 * 1024 * 1024 },
  api: { nanoCpus: 400_000_000, memoire: 448 * 1024 * 1024 },
  'staging-dashboard': { nanoCpus: 150_000_000, memoire: 128 * 1024 * 1024 },
  'staging-portfolio': { nanoCpus: 150_000_000, memoire: 128 * 1024 * 1024 },
};

const VERIFICATION = `#!/bin/sh
# Le double de verifier-environnement.js : refuse toute base autre que celle du staging.
case "$DATABASE_URL" in
  *@staging-db:*) echo "environnement vérifié" ;;
  *) echo "DATABASE_URL désigne la base de production" >&2; exit 1 ;;
esac
`;

const MIGRATION = `#!/bin/sh
set -e
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "create table if not exists demo (id serial primary key, titre text not null)"
`;

const SEMIS = `#!/bin/sh
set -e
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "truncate demo; insert into demo (titre) values ${LIGNES_DE_DEMO.map((l) => `('${l}')`).join(', ')}"
`;

const PILE_PROD = [
  'services:',
  '  db:',
  '    image: postgres:18-alpine',
  '    environment:',
  '      POSTGRES_PASSWORD: prod',
  '  api:',
  '    image: ${IMAGE}',
  '',
].join('\n');

describe('deploy-staging.sh, de bout en bout', () => {
  let racine: string;
  let registre: Registre;
  let depot: Depot;
  let cloneProd: string;
  let fixture: Fixture;
  let confPath: string;
  let envStaging: string;
  let pileProd: string;
  let historique: string;
  let espion: string;
  let journalDesRun: string;
  const revisions: string[] = [];

  /**
   * Toujours avec la base de la prod dans le shell de l'appelant : Compose la
   * préférerait à celle du fichier d'environnement du staging si le script la
   * lui laissait voir.
   */
  function deployer(revision: string) {
    return run('deploy-staging.sh', [revision], fixture, {
      DATABASE_URL: 'postgresql://personalos:prod@db:5432/personalos',
      PATH: `${espion}:${process.env['PATH']}`,
    });
  }

  /**
   * Un `docker` qui, avant chaque `compose run`, note les services du staging
   * qui tournent déjà : le conteneur jetable du `run` s'ajoute à eux, et leur
   * somme doit rester sous le plafond total.
   */
  function installerEspion(): void {
    const reel = sh('sh', ['-c', 'command -v docker']).trim();
    mkdirSync(espion, { recursive: true });
    const script = join(espion, 'docker');
    writeFileSync(
      script,
      [
        '#!/bin/sh',
        'case " $* " in',
        `  *" compose "*" run "*) "${reel}" ps --filter label=com.docker.compose.project=${PROJET_STAGING} \\`,
        `      --format '{{.Label "com.docker.compose.service"}}' | sort | tr '\\n' ' ' >>"${journalDesRun}"`,
        `    echo >>"${journalDesRun}" ;;`,
        'esac',
        `exec "${reel}" "$@"`,
        '',
      ].join('\n'),
      { mode: 0o755 }
    );
  }

  /** Les services du staging qui tournaient pendant chaque `compose run`. */
  function servicesPendantLesRun(): string[][] {
    return readFileSync(journalDesRun, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((ligne) => ligne.trim().split(' ').filter(Boolean));
  }

  /** Le journal du script accompagne le statut, pour qu'un échec se lise. */
  function reussi(resultat: ReturnType<typeof deployer>): void {
    if (resultat.status !== 0) {
      throw new Error(`deploy-staging.sh a échoué (${resultat.status}) :\n${resultat.stderr}`);
    }
  }

  function requeteStaging(sql: string): string {
    return sh('docker', [
      'exec', '--env', `PGPASSWORD=${MOT_DE_PASSE}`, service('db'), 'psql', '--username', 'personalos', '--dbname', 'personalos',
      '--tuples-only', '--no-align', '--command', sql,
    ]).trim();
  }

  function conteneurs(projet: string): string[] {
    return sh('docker', [
      'ps', '--all', '--quiet', '--no-trunc',
      '--filter', `label=com.docker.compose.project=${projet}`,
    ]).trim().split('\n').filter(Boolean);
  }

  /** Identifiant, démarrage et image de chaque conteneur du projet. */
  function empreinte(projet: string): string[] {
    return conteneurs(projet)
      .map((id) =>
        sh('docker', ['inspect', '--format', '{{.Id}} {{.State.StartedAt}} {{.Config.Image}} {{.State.Status}}', id]).trim()
      )
      .sort();
  }

  function service(nom: string): string {
    return sh('docker', [
      'ps', '--quiet',
      '--filter', `label=com.docker.compose.project=${PROJET_STAGING}`,
      '--filter', `label=com.docker.compose.service=${nom}`,
    ]).trim();
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

  function commettre(message: string): string {
    const cible = join(depot.travail, 'infra', 'deploy');
    mkdirSync(cible, { recursive: true });
    copyFileSync(join(SOURCE_ROOT, 'docker-compose.staging.yml'), join(cible, 'docker-compose.staging.yml'));
    writeFileSync(join(cible, 'marque'), `${message}\n`);
    sh('git', ['add', '--all'], { cwd: depot.travail });
    sh('git', ['commit', '--quiet', '--message', message], { cwd: depot.travail });
    sh('git', ['push', '--quiet', '--force', 'origin', 'main'], { cwd: depot.travail });
    return sh('git', ['rev-parse', 'HEAD'], { cwd: depot.travail }).trim();
  }

  /** Une image qui sert /api/health sur 3000, et porte les trois scripts. */
  function publierImages(revision: string): void {
    const dir = join(racine, `image-${revision.slice(0, 7)}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'verifier.sh'), VERIFICATION);
    writeFileSync(join(dir, 'migrate.sh'), MIGRATION);
    writeFileSync(join(dir, 'seed.sh'), SEMIS);
    writeFileSync(
      join(dir, 'Dockerfile'),
      [
        'FROM postgres:18-alpine',
        'ENTRYPOINT []',
        'RUN apk add --no-cache busybox-extras',
        'RUN mkdir -p /www/api && echo ok > /www/api/health',
        'COPY verifier.sh migrate.sh seed.sh /',
        'RUN chmod +x /verifier.sh /migrate.sh /seed.sh',
        'CMD ["httpd", "-f", "-p", "3000", "-h", "/www"]',
        '',
      ].join('\n')
    );
    const base = `${registre.prefixe}/api:${revision}`;
    sh('docker', ['build', '--quiet', '--tag', base, dir]);
    for (const image of ['api', 'dashboard', 'portfolio']) {
      const reference = `${registre.prefixe}/${image}:${revision}`;
      sh('docker', ['tag', base, reference]);
      sh('docker', ['push', '--quiet', reference]);
    }
  }

  function ecrireEnvStaging(databaseUrl: string): void {
    writeFileSync(
      envStaging,
      [
        'APP_ENV=staging',
        'POSTGRES_USER=personalos',
        `POSTGRES_PASSWORD=${MOT_DE_PASSE}`,
        'POSTGRES_DB=personalos',
        `DATABASE_URL=${databaseUrl}`,
        'PROD_DATABASE_HOST=db',
        `STAGING_API_PORT=${API_PORT}`,
        'OIDC_ISSUER=https://auth.exemple.test/application/o/personal-os-staging/',
        'OIDC_CLIENT_ID=personal-os-staging',
        'OIDC_CLIENT_SECRET=jetable',
        'OIDC_REDIRECT_URI=https://staging.exemple.test/api/auth/callback',
        'DASHBOARD_URL=https://staging.exemple.test/',
        'AUTH_ALLOWED_EMAILS=a@exemple.test,b@exemple.test',
        'DEMO_ACCOUNT_EMAILS=a@exemple.test,b@exemple.test',
        '',
      ].join('\n')
    );
  }

  const URL_STAGING = `postgresql://personalos:${MOT_DE_PASSE}@staging-db:5432/personalos`;

  function nettoyer(): void {
    for (const projet of [PROJET_STAGING, PROJET_PROD]) {
      const ids = conteneursSilencieux(projet);
      if (ids.length > 0) silence(() => sh('docker', ['rm', '--force', '--volumes', ...ids]));
      silence(() => sh('docker', ['network', 'rm', `${projet}_default`]));
      silence(() => sh('docker', ['volume', 'rm', `${projet}_staging-db-data`]));
    }
    silence(() => sh('docker', ['network', 'rm', RESEAU]));
  }

  function conteneursSilencieux(projet: string): string[] {
    try {
      return conteneurs(projet);
    } catch {
      return [];
    }
  }

  beforeAll(async () => {
    for (const outil of ['docker', 'git', 'curl']) {
      requireTool(outil);
    }

    silence(() => sh('docker', ['rm', '--force', REGISTRE_CONTENEUR]));
    nettoyer();
    const pris = await portsPris([
      { port: REGISTRE_PORT, role: 'le registre' },
      { port: API_PORT, role: "l'API du staging" },
    ]);
    if (pris.length > 0) {
      throw new Error(
        `La campagne du staging ne peut pas tourner : ${pris
          .map(({ port, role }) => `le port ${port} (${role})`)
          .join(', ')} déjà pris. Une autre campagne tourne probablement : attendre qu’elle finisse.`
      );
    }

    racine = mkdtempSync(join(tmpdir(), 'personal-os-staging-'));
    depot = creerDepot(racine);
    revisions.push(commettre('première version'), commettre('seconde version'));
    clonerDepot(depot);
    cloneProd = join(racine, 'clone-prod');
    sh('git', ['clone', '--quiet', depot.origine, cloneProd]);
    sh('git', ['checkout', '--quiet', '--detach', revisions[0]], { cwd: cloneProd });

    registre = demarrerRegistre(REGISTRE_CONTENEUR, REGISTRE_PORT);
    for (const revision of revisions) publierImages(revision);

    // La « prod » : un projet à part, qui tourne avant et doit tourner après.
    pileProd = join(racine, 'prod.yml');
    writeFileSync(pileProd, PILE_PROD);
    sh('docker', ['compose', '--file', pileProd, '--project-name', PROJET_PROD, 'up', '--detach', '--wait'], {
      env: { IMAGE: `${registre.prefixe}/api:${revisions[0]}` },
    });

    envStaging = join(racine, 'staging.env');
    ecrireEnvStaging(URL_STAGING);
    historique = join(racine, 'deploy-staging.log');
    espion = join(racine, 'espion');
    journalDesRun = join(racine, 'services-pendant-les-run');
    installerEspion();

    confPath = join(racine, 'deploy.conf');
    const ghcr = join(racine, 'ghcr.env');
    writeFileSync(ghcr, '');
    writeFileSync(
      confPath,
      [
        `REGISTRY=${registre.prefixe}`,
        'IMAGES="api dashboard portfolio"',
        `COMPOSE_FILE=${pileProd}`,
        `COMPOSE_ENV_FILE=${join(racine, 'stack.env')}`,
        `COMPOSE_PROJECT=${PROJET_PROD}`,
        `SOURCE_CHECKOUT=${cloneProd}`,
        'MIGRATE_SERVICE=api',
        'MIGRATE_COMMAND=/migrate.sh',
        `STAGING_COMPOSE_FILE=${join(racine, 'staging', 'docker-compose.yml')}`,
        `STAGING_ENV_FILE=${envStaging}`,
        `STAGING_PROJECT=${PROJET_STAGING}`,
        `STAGING_SOURCE_CHECKOUT=${depot.clone}`,
        `STAGING_EDGE_NETWORK=${RESEAU}`,
        'STAGING_CHECK_COMMAND=/verifier.sh',
        'STAGING_SEED_COMMAND=/seed.sh',
        `STAGING_HEALTH_URL=${SANTE_URL}`,
        `STAGING_HISTORY_FILE=${historique}`,
        'HEALTH_RETRIES=15',
        'HEALTH_DELAY=1',
        'DEPLOY_HEARTBEAT_URL=',
      ].join('\n')
    );
    fixture = {
      dir: racine,
      confPath,
      envPath: ghcr,
      composePath: pileProd,
      statePath: join(racine, 'deploy-state'),
      historyPath: historique,
      restorePath: '',
    };
  });

  afterAll(() => {
    if (!racine) return;
    nettoyer();
    silence(() => sh('docker', ['rm', '--force', REGISTRE_CONTENEUR]));
    for (const revision of revisions) {
      for (const image of ['api', 'dashboard', 'portfolio']) {
        silence(() => sh('docker', ['rmi', '--force', `${registre.prefixe}/${image}:${revision}`]));
      }
    }
    rmSync(racine, { recursive: true, force: true });
  });

  it('déploie le commit, remet la base au jeu de démo, et ne touche à aucun conteneur de la prod', () => {
    const prodAvant = empreinte(PROJET_PROD);
    const cloneProdAvant = sh('git', ['rev-parse', 'HEAD'], { cwd: cloneProd }).trim();

    reussi(deployer(revisions[0]));

    expect(sante()).toBe(200);
    expect(requeteStaging('select titre from demo order by id')).toBe(LIGNES_DE_DEMO.join('\n'));
    expect(readFileSync(historique, 'utf8')).toContain(`succes\t${revisions[0]}`);

    expect(empreinte(PROJET_PROD)).toEqual(prodAvant);
    expect(sh('git', ['rev-parse', 'HEAD'], { cwd: cloneProd }).trim()).toBe(cloneProdAvant);
  });

  it('applique les plafonds du fichier de staging à chacun de ses conteneurs', () => {
    for (const [nom, plafond] of Object.entries(PLAFONDS)) {
      const [nanoCpus, memoire] = sh('docker', [
        'inspect', '--format', '{{.HostConfig.NanoCpus}} {{.HostConfig.Memory}}', service(nom),
      ]).trim().split(' ').map(Number);

      expect({ nom, nanoCpus, memoire }).toEqual({ nom, ...plafond });
    }
  });

  it('expose le tableau de bord et le portfolio sur le réseau partagé, et rien d’autre', () => {
    const membres = sh('docker', [
      'network', 'inspect', RESEAU, '--format', '{{range .Containers}}{{.Name}} {{end}}',
    ]).trim().split(' ').sort();

    expect(membres).toEqual([`${PROJET_STAGING}-staging-dashboard-1`, `${PROJET_STAGING}-staging-portfolio-1`]);
  });

  it('reste sous le plafond total pendant un redéploiement : seule la base tourne à côté des commandes jetables', () => {
    writeFileSync(journalDesRun, '');

    reussi(deployer(revisions[0]));

    // Vérification, migration, semis : chacune dans un conteneur `api` de
    // plus, à côté de la seule base (0,30 + 0,40 CPU, 320 + 448 Mio).
    expect(servicesPendantLesRun()).toEqual([['db'], ['db'], ['db']]);
    expect(sante()).toBe(200);
  });

  it('repart du jeu de démo au déploiement suivant, quoi qu’on ait saisi entre-temps', () => {
    requeteStaging("insert into demo (titre) values ('saisi sur le staging')");
    const prodAvant = empreinte(PROJET_PROD);

    reussi(deployer(revisions[1]));

    expect(requeteStaging('select titre from demo order by id')).toBe(LIGNES_DE_DEMO.join('\n'));
    expect(sh('docker', ['inspect', '--format', '{{.Config.Image}}', service('api')]).trim()).toBe(
      `${registre.prefixe}/api:${revisions[1]}`
    );
    expect(sante()).toBe(200);
    expect(empreinte(PROJET_PROD)).toEqual(prodAvant);
  });

  it('s’arrête avant de migrer ou de semer quand l’environnement désigne la base de la prod', () => {
    requeteStaging("insert into demo (titre) values ('saisi sur le staging')");
    ecrireEnvStaging(`postgresql://personalos:${MOT_DE_PASSE}@db:5432/personalos`);

    try {
      const resultat = deployer(revisions[1]);

      expect(resultat.status).not.toBe(0);
      expect(resultat.stderr).toContain('environnement du staging refusé');
      expect(resultat.stderr).not.toContain('semis du jeu de démo');
      expect(readFileSync(historique, 'utf8')).toContain(`environnement-refuse\t${revisions[1]}`);
      expect(requeteStaging('select count(*) from demo')).toBe(String(LIGNES_DE_DEMO.length + 1));
    } finally {
      ecrireEnvStaging(URL_STAGING);
    }
  });
});
