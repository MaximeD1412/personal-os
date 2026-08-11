import { makeFixture, run, SECRET } from './run-script';

describe('restore.sh --dry-run', () => {
  it('annonce la restauration vers la cible demandée', () => {
    const result = run(
      'restore.sh',
      ['--dry-run', '--target', '/var/tmp/restauration'],
      makeFixture()
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('plan: restic restore latest --target /var/tmp/restauration');
  });

  it('accepte un instantané précis', () => {
    const result = run(
      'restore.sh',
      ['--dry-run', '--snapshot', 'a1b2c3d4', '--target', '/var/tmp/restauration'],
      makeFixture()
    );

    expect(result.stdout).toContain('restic restore a1b2c3d4');
  });

  it('annonce le conteneur jetable et le DSN quand on remonte la base', () => {
    // Le dry-run annonce, il ne promet pas : la ligne « dsn: » réellement
    // consommée par le banc d'essai de migration (#4, ADR 0021) est verrouillée
    // par le test d'intégration, où elle porte un vrai mot de passe.
    const result = run(
      'restore.sh',
      ['--dry-run', '--target', '/var/tmp/restauration', '--into-postgres'],
      makeFixture()
    );

    expect(result.stdout).toContain('plan: conteneur jetable personal-os-restore-');
    expect(result.stdout).toMatch(/^plan: dsn: postgresql:\/\//m);
  });

  it('ne relit les paquets que si on le demande', () => {
    // `--read-data` retélécharge tout le dépôt : utile pour la vérification
    // trimestrielle, ruineux à chaque déploiement.
    const sans = run(
      'restore.sh',
      ['--dry-run', '--target', '/var/tmp/restauration'],
      makeFixture()
    );
    const avec = run(
      'restore.sh',
      ['--dry-run', '--target', '/var/tmp/restauration', '--read-data'],
      makeFixture()
    );

    expect(sans.stdout).not.toContain('--read-data');
    expect(avec.stdout).toContain('restic check --read-data');
  });

  it('ne laisse jamais la clé apparaître dans sa sortie', () => {
    const result = run(
      'restore.sh',
      ['--dry-run', '--target', '/var/tmp/restauration', '--into-postgres'],
      makeFixture()
    );

    expect(result.output).not.toContain(SECRET);
  });
});

describe('restore.sh — garde-fous', () => {
  it('exige une cible explicite', () => {
    // Une cible par défaut serait une invitation à écraser quelque chose.
    const result = run('restore.sh', ['--dry-run'], makeFixture());

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('--target');
  });

  it.each(['/var/lib/postgresql', '/var/lib/postgresql/18/main', '/etc/personal-os'])(
    'refuse de restaurer vers %s',
    (target) => {
      // C'est la faute qui coûte tout : un banc d'essai branché sur les données
      // réelles écraserait ce qu'il est censé protéger.
      const result = run('restore.sh', ['--dry-run', '--target', target], makeFixture());

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('interdite');
    }
  );

  it('vérifie le garde-fou avant tout effet de bord, y compris en --dry-run', () => {
    // Une configuration fautive doit se voir sans avoir à risquer une vraie
    // restauration pour la découvrir.
    const result = run(
      'restore.sh',
      ['--dry-run', '--target', '/var/lib/postgresql'],
      makeFixture()
    );

    expect(result.stdout).not.toContain('plan:');
  });
});
