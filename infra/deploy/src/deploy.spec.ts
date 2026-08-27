import { makeFixture, run, SECRET } from './run-script';

const REVISION = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const PRECEDENTE = '0f1e2d3c4b5a69788796a5b4c3d2e1f001234567';

function etape(plan: string, aiguille: string): number {
  return plan.split('\n').findIndex((ligne) => ligne.includes(aiguille));
}

describe('deploy.sh --dry-run', () => {
  it('annonce la séquence de l’ADR 0023 dans l’ordre', () => {
    const plan = run('deploy.sh', ['--dry-run', '--revision', REVISION], makeFixture()).stdout;

    const repetition = etape(plan, 'plan: répétition ');
    const migrationRepetee = etape(plan, 'plan: répétition migration');
    const recuperation = etape(plan, 'plan: docker compose pull');
    const migrationReelle = etape(plan, 'plan: migration réelle');
    const redemarrage = etape(plan, 'plan: docker compose up');
    const sante = etape(plan, 'plan: santé');

    expect(repetition).toBeGreaterThanOrEqual(0);
    expect(repetition).toBeLessThan(migrationRepetee);
    expect(migrationRepetee).toBeLessThan(recuperation);
    expect(recuperation).toBeLessThan(migrationReelle);
    expect(migrationReelle).toBeLessThan(redemarrage);
    expect(redemarrage).toBeLessThan(sante);
  });

  it('répète la migration sur une restauration jetable, laissée en vie', () => {
    const plan = run('deploy.sh', ['--dry-run', '--revision', REVISION], makeFixture()).stdout;

    expect(plan).toContain('--into-postgres --keep');
  });

  it('reprend la pile et le routage du dépôt à la révision déployée', () => {
    const plan = run('deploy.sh', ['--dry-run', '--revision', REVISION], makeFixture()).stdout;

    expect(plan).toMatch(/plan: pile et routage repris de .* en a1b2c3d4/);
  });

  it('annonce le retour arrière comme issue d’un échec de santé', () => {
    const fixture = makeFixture({ state: `DEPLOYED_REVISION=${PRECEDENTE}\n` });
    const plan = run('deploy.sh', ['--dry-run', '--revision', REVISION], fixture).stdout;

    expect(plan).toContain(`retour aux images ${PRECEDENTE}`);
    expect(plan).toContain('sans toucher la base');
  });

  it('reste lisible sans réseau quand aucune révision n’est donnée', () => {
    const resultat = run('deploy.sh', ['--dry-run'], makeFixture());

    expect(resultat.status).toBe(0);
    expect(resultat.stdout).toContain('<révision du canal>');
  });

  it('ne laisse jamais le jeton de registre apparaître dans sa sortie', () => {
    const resultat = run('deploy.sh', ['--dry-run', '--revision', REVISION], makeFixture());

    expect(resultat.output).not.toContain(SECRET);
  });
});

describe('deploy.sh --rollback --dry-run', () => {
  it('revient sur la révision précédente enregistrée', () => {
    const fixture = makeFixture({
      state: `DEPLOYED_REVISION=${REVISION}\nPREVIOUS_REVISION=${PRECEDENTE}\n`,
    });

    const plan = run('deploy.sh', ['--dry-run', '--rollback'], fixture).stdout;

    expect(plan).toContain(`retour aux images ghcr.io/exemple/personal-os/*:${PRECEDENTE}`);
  });

  it('ne contient aucune étape de migration', () => {
    const fixture = makeFixture({
      state: `DEPLOYED_REVISION=${REVISION}\nPREVIOUS_REVISION=${PRECEDENTE}\n`,
    });

    const etapes = run('deploy.sh', ['--dry-run', '--rollback'], fixture)
      .stdout.split('\n')
      .filter((ligne) => ligne.startsWith('plan: '));

    expect(etapes.filter((ligne) => /migration|répétition/.test(ligne))).toEqual([
      'plan: aucune migration — un retour arrière ne touche jamais la base',
    ]);
  });

  it('refuse de revenir quand rien n’a jamais été déployé', () => {
    const resultat = run('deploy.sh', ['--dry-run', '--rollback'], makeFixture());

    expect(resultat.status).not.toBe(0);
    expect(resultat.stderr).toContain('aucune révision précédente');
  });
});

describe('deploy.sh — garde-fous', () => {
  it('refuse une révision mouvante', () => {
    const resultat = run('deploy.sh', ['--dry-run', '--revision', 'main'], makeFixture());

    expect(resultat.status).not.toBe(0);
    expect(resultat.stderr).toContain('mouvante');
  });

  it('refuse une révision trop courte pour être un commit', () => {
    const resultat = run('deploy.sh', ['--dry-run', '--revision', 'abc'], makeFixture());

    expect(resultat.status).not.toBe(0);
    expect(resultat.stderr).toContain('trop courte');
  });

  it('refuse de déployer si le banc d’essai de migration est absent', () => {
    const resultat = run(
      'deploy.sh',
      ['--dry-run', '--revision', REVISION],
      makeFixture({ restoreScript: null })
    );

    expect(resultat.status).not.toBe(0);
    expect(resultat.stderr).toContain("banc d'essai de migration absent");
  });

  it('refuse de déployer sans pile de production lisible', () => {
    const fixture = makeFixture({ extraConf: 'COMPOSE_FILE=/nexistepas/docker-compose.yml' });

    const resultat = run('deploy.sh', ['--dry-run', '--revision', REVISION], fixture);

    expect(resultat.status).not.toBe(0);
    expect(resultat.stderr).toContain('pile de production illisible');
  });

  it('vérifie les garde-fous avant tout effet de bord, y compris en --dry-run', () => {
    const resultat = run(
      'deploy.sh',
      ['--dry-run', '--revision', REVISION],
      makeFixture({ restoreScript: null })
    );

    expect(resultat.stdout).not.toContain('plan:');
  });

  it('refuse une configuration absente', () => {
    const fixture = makeFixture();

    const resultat = run('deploy.sh', ['--dry-run'], fixture, {
      DEPLOY_CONF: '/nexistepas/deploy.conf',
    });

    expect(resultat.status).not.toBe(0);
    expect(resultat.stderr).toContain('configuration illisible');
  });
});

describe('deploy.sh — mémoire des versions', () => {
  it('ne fait rien quand la révision du canal est déjà en place', () => {
    const fixture = makeFixture({ state: `DEPLOYED_REVISION=${REVISION}\n` });

    const resultat = run('deploy.sh', ['--revision', REVISION], fixture);

    expect(resultat.status).toBe(0);
    expect(resultat.stderr).toContain('déjà en place');
  });

  it('ne rejoue pas une révision qui a déjà échoué', () => {
    const fixture = makeFixture({
      state: `DEPLOYED_REVISION=${PRECEDENTE}\nFAILED_REVISION=${REVISION}\n`,
    });

    const resultat = run('deploy.sh', ['--revision', REVISION], fixture);

    expect(resultat.status).toBe(0);
    expect(resultat.stderr).toContain('déjà en échec');
    expect(resultat.stderr).toContain('--force');
  });
});
