import { readFileSync, writeFileSync } from 'node:fs';

import { makeFixture, run, SECRET } from './run-script';

describe('backup.sh --dry-run', () => {
  it('annonce le dépôt, le dump, la rétention et la vérification', () => {
    const result = run('backup.sh', ['--dry-run'], makeFixture());

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('plan: dépôt b2:personal-os-restic-test:/');
    expect(result.stdout).toContain('pg_dump -U personalos -d personalos');
    expect(result.stdout).toContain('plan: restic check');
  });

  it('applique la rétention configurée, sans jamais oublier --prune', () => {
    const result = run('backup.sh', ['--dry-run'], makeFixture());

    expect(result.stdout).toContain(
      'restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune',
    );
  });

  it('demande le dump sans compression, pour que Restic puisse dédupliquer', () => {
    const result = run('backup.sh', ['--dry-run'], makeFixture());

    expect(result.stdout).toContain('-Z0');
  });

  it("dumpe chacune des bases du serveur, pas seulement celle de l'application", () => {
    const fixture = makeFixture({
      conf: [
        'POSTGRES_DB=personalos',
        'POSTGRES_DATABASES="personalos authentik"',
        'BACKUP_PATHS=""',
      ].join('\n'),
    });

    const result = run('backup.sh', ['--dry-run'], fixture);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('-d personalos');
    expect(result.stdout).toContain('-d authentik');
    expect(result.stdout).toContain('postgres/personalos.dump');
    expect(result.stdout).toContain('postgres/authentik.dump');
  });

  it("dumpe la base de l'application quand aucune liste n'est donnée", () => {
    const result = run('backup.sh', ['--dry-run'], makeFixture());

    expect(result.stdout).toContain('postgres/personalos.dump');
  });

  it('refuse un nom de base qui ne ressemble pas à un nom de base', () => {
    const fixture = makeFixture({
      conf: [
        'POSTGRES_DB=personalos',
        'POSTGRES_DATABASES="personalos ../evasion"',
      ].join('\n'),
    });

    const result = run('backup.sh', ['--dry-run'], fixture);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('nom de base');
  });

  it('inclut les cibles du fichier de configuration, sans toucher au script', () => {
    const fixture = makeFixture({
      conf: [
        'POSTGRES_DB=personalos',
        'BACKUP_PATHS="/etc/authentik /srv/objets"',
      ].join('\n'),
    });

    const result = run('backup.sh', ['--dry-run'], fixture);

    expect(result.stdout).toContain('plan: inclut /etc/authentik');
    expect(result.stdout).toContain('plan: inclut /srv/objets');
  });

  describe('le bucket du stockage objet', () => {
    const SECRET_S3 = 'secret-s3-qui-ne-doit-jamais-fuiter';
    const CONF_AVEC_BUCKET = [
      'POSTGRES_DB=personalos',
      'BACKUP_PATHS=""',
      'S3_MIRROR_ENDPOINT=https://s3.gra.io.cloud.ovh.net',
      'S3_MIRROR_REGION=gra',
      'S3_MIRROR_BUCKET=personal-os',
    ].join('\n');

    function avecBucket(cles: string[]) {
      const fixture = makeFixture({ conf: CONF_AVEC_BUCKET });
      writeFileSync(
        fixture.envPath,
        [readFileSync(fixture.envPath, 'utf8'), ...cles].join('\n'),
      );
      return fixture;
    }

    const CLES = [
      'S3_MIRROR_ACCESS_KEY_ID=identifiant-s3-de-test',
      `S3_MIRROR_SECRET_ACCESS_KEY=${SECRET_S3}`,
    ];

    it("le recopie dans l'instantané, à côté des dumps", () => {
      const result = run('backup.sh', ['--dry-run'], avecBucket(CLES));

      expect(result.status).toBe(0);
      expect(result.stdout).toContain(
        'plan: copie du bucket personal-os (https://s3.gra.io.cloud.ovh.net) -> <transit>/objets',
      );
    });

    it('ne laisse jamais sa clé apparaître dans la sortie', () => {
      const result = run('backup.sh', ['--dry-run'], avecBucket(CLES));

      expect(result.output).not.toContain(SECRET_S3);
    });

    it("refuse de démarrer sans les clés d'accès du bucket", () => {
      const result = run('backup.sh', ['--dry-run'], avecBucket([]));

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('S3_MIRROR_ACCESS_KEY_ID');
    });

    it("ne copie rien quand aucun bucket n'est configuré", () => {
      const result = run('backup.sh', ['--dry-run'], makeFixture());

      expect(result.stdout).not.toContain('copie du bucket');
    });
  });

  it('ne laisse jamais la clé apparaître dans sa sortie', () => {
    const result = run('backup.sh', ['--dry-run'], makeFixture());

    expect(result.output).not.toContain(SECRET);
  });
});

describe('backup.sh — garde-fous sur les secrets', () => {
  it("refuse un mot de passe passé par l'environnement", () => {
    const fixture = makeFixture({
      env: ['RESTIC_REPOSITORY=b2:test:/', `RESTIC_PASSWORD=${SECRET}`].join(
        '\n',
      ),
    });

    const result = run('backup.sh', ['--dry-run'], fixture);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('RESTIC_PASSWORD');
  });

  it('refuse un fichier de clé lisible par autrui', () => {
    const fixture = makeFixture({ passwordMode: 0o644 });

    const result = run('backup.sh', ['--dry-run'], fixture);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('644');
  });

  it('refuse de démarrer sans configuration', () => {
    const fixture = makeFixture();
    const result = run('backup.sh', ['--dry-run'], fixture, {
      BACKUP_CONF: '/chemin/absent/backup.conf',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('configuration illisible');
  });

  it("refuse un argument inconnu plutôt que de l'ignorer", () => {
    const result = run('backup.sh', ['--dry-runn'], makeFixture());

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('argument inconnu');
  });
});
