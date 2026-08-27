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
    const result = run(
      'restore.sh',
      ['--dry-run', '--target', '/var/tmp/restauration', '--into-postgres'],
      makeFixture()
    );

    expect(result.stdout).toContain('plan: conteneur jetable personal-os-restore-');
    expect(result.stdout).toMatch(/^plan: dsn: postgresql:\/\//m);
  });

  it("remonte la base de l'application par défaut", () => {
    const result = run(
      'restore.sh',
      ['--dry-run', '--target', '/var/tmp/restauration', '--into-postgres'],
      makeFixture()
    );

    expect(result.stdout).toContain('postgres/personalos.dump');
  });

  it('remonte une autre base du même instantané quand on la nomme', () => {
    const result = run(
      'restore.sh',
      [
        '--dry-run',
        '--target',
        '/var/tmp/restauration',
        '--into-postgres',
        '--database',
        'authentik',
      ],
      makeFixture({
        conf: [
          'POSTGRES_DB=personalos',
          'POSTGRES_DATABASES="personalos authentik"',
        ].join('\n'),
      })
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('postgres/authentik.dump');
  });

  it("refuse de remonter une base qui n'est pas sauvegardée", () => {
    const result = run(
      'restore.sh',
      [
        '--dry-run',
        '--target',
        '/var/tmp/restauration',
        '--into-postgres',
        '--database',
        'inexistante',
      ],
      makeFixture()
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('inexistante');
  });

  it('ne relit les paquets que si on le demande', () => {
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
    const result = run('restore.sh', ['--dry-run'], makeFixture());

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('--target');
  });

  it.each(['/var/lib/postgresql', '/var/lib/postgresql/18/main', '/etc/personal-os'])(
    'refuse de restaurer vers %s',
    (target) => {
      const result = run('restore.sh', ['--dry-run', '--target', target], makeFixture());

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('interdite');
    }
  );

  it('vérifie le garde-fou avant tout effet de bord, y compris en --dry-run', () => {
    const result = run(
      'restore.sh',
      ['--dry-run', '--target', '/var/lib/postgresql'],
      makeFixture()
    );

    expect(result.stdout).not.toContain('plan:');
  });
});
