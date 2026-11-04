import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { Fixture, makeFixture, run, SECRET } from './run-script';

const REVISION = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';

const ENV_STAGING = ['APP_ENV=staging', 'POSTGRES_PASSWORD=jetable', ''].join('\n');

/** Une configuration d'agent qui connaît le staging, à côté de la prod. */
function fixtureStaging(
  options: { conf?: (dir: string) => string; env?: string | null } = {}
): Fixture {
  const fixture = makeFixture({
    extraConf: (dir) =>
      [
        `STAGING_COMPOSE_FILE=${join(dir, 'staging', 'docker-compose.yml')}`,
        `STAGING_ENV_FILE=${join(dir, 'staging.env')}`,
        'STAGING_PROJECT=personal-os-staging-test',
        `STAGING_SOURCE_CHECKOUT=${join(dir, 'staging', 'src')}`,
        'STAGING_HEALTH_URL=http://127.0.0.1:3101/api/health',
        'STAGING_EDGE_NETWORK=personal-os-staging-edge-test',
        `STAGING_HISTORY_FILE=${join(dir, 'deploy-staging.log')}`,
        options.conf?.(dir) ?? '',
      ].join('\n'),
  });
  if (options.env !== null) {
    writeFileSync(join(fixture.dir, 'staging.env'), options.env ?? ENV_STAGING);
  }
  return fixture;
}

function etape(plan: string, aiguille: string): number {
  return plan.split('\n').findIndex((ligne) => ligne.startsWith(`plan: ${aiguille}`));
}

describe('deploy-staging.sh --dry-run', () => {
  it('annonce, dans l’ordre : images, base, vérification, migration, semis, redémarrage, santé', () => {
    const resultat = run('deploy-staging.sh', [REVISION, '--dry-run'], fixtureStaging());
    const plan = resultat.stdout;

    expect(resultat.status).toBe(0);
    const ordre = [
      'pile reprise',
      'réseau',
      'docker compose pull',
      'base',
      "vérification de l'environnement",
      'migration',
      'semis',
      'docker compose up',
      'santé',
    ].map((aiguille) => etape(plan, aiguille));

    expect(ordre.every((position) => position >= 0)).toBe(true);
    expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
  });

  it('ne vise que le projet du staging, jamais celui de la prod', () => {
    const plan = run('deploy-staging.sh', [REVISION, '--dry-run'], fixtureStaging()).stdout;

    expect(plan).toContain('personal-os-staging-test');
    expect(plan).toContain('personal-os-test (prod) non touché');
  });

  it('ne répète rien sur une restauration et ne prévoit aucun retour arrière', () => {
    const plan = run('deploy-staging.sh', [REVISION, '--dry-run'], fixtureStaging()).stdout;

    expect(plan).not.toMatch(/répétition|restore/);
    expect(plan).toContain('aucun retour arrière');
  });

  it('ne laisse jamais le jeton de registre apparaître dans sa sortie', () => {
    const resultat = run('deploy-staging.sh', [REVISION, '--dry-run'], fixtureStaging());

    expect(resultat.output).not.toContain(SECRET);
  });
});

describe('deploy-staging.sh — garde-fous', () => {
  function refus(fixture: Fixture, args: string[] = [REVISION, '--dry-run']) {
    const resultat = run('deploy-staging.sh', args, fixture);
    expect(resultat.status).not.toBe(0);
    expect(resultat.stdout).not.toContain('plan:');
    return resultat.stderr;
  }

  it('exige un commit', () => {
    expect(refus(fixtureStaging(), ['--dry-run'])).toContain('usage');
  });

  it('refuse une révision mouvante', () => {
    expect(refus(fixtureStaging(), ['develop', '--dry-run'])).toContain('mouvante');
  });

  it('refuse de déployer sous le nom du projet de la prod', () => {
    const fixture = fixtureStaging({ conf: () => 'STAGING_PROJECT=personal-os-test' });

    expect(refus(fixture)).toContain('projet de la prod');
  });

  it('refuse la pile ou l’environnement de la prod', () => {
    const pile = fixtureStaging({ conf: (dir) => `STAGING_COMPOSE_FILE=${join(dir, 'docker-compose.yml')}` });
    const env = fixtureStaging({ conf: (dir) => `STAGING_ENV_FILE=${join(dir, 'stack.env')}` });

    expect(refus(pile)).toContain('pile de la prod');
    expect(refus(env)).toContain('environnement de la prod');
  });

  it('refuse un environnement absent', () => {
    expect(refus(fixtureStaging({ env: null }))).toContain('environnement du staging illisible');
  });

  it('refuse un environnement qui ne pose pas APP_ENV=staging', () => {
    const production = fixtureStaging({ env: 'APP_ENV=production\n' });
    const muet = fixtureStaging({ env: 'POSTGRES_PASSWORD=jetable\n' });

    expect(refus(production)).toContain('APP_ENV=staging');
    expect(refus(muet)).toContain('APP_ENV=staging');
  });
});
