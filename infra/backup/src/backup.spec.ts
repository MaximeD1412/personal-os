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
    // Sans --prune, `forget` retire les instantanés de l'index mais ne libère
    // aucun octet : le dépôt grossit indéfiniment pendant que la rétention
    // semble appliquée.
    const result = run('backup.sh', ['--dry-run'], makeFixture());

    expect(result.stdout).toContain(
      'restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune'
    );
  });

  it('demande le dump sans compression, pour que Restic puisse dédupliquer', () => {
    const result = run('backup.sh', ['--dry-run'], makeFixture());

    expect(result.stdout).toContain('-Z0');
  });

  it("inclut les cibles du fichier de configuration, sans toucher au script", () => {
    // C'est le mécanisme d'élargissement du périmètre : #5 ajoutera Authentik
    // ici, et le stockage objet suivra le même chemin.
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

  it('ne laisse jamais la clé apparaître dans sa sortie', () => {
    // Le plan est destiné à être relu, collé dans un ticket, capturé par le
    // journal. Une clé qui y transite a quitté la machine.
    const result = run('backup.sh', ['--dry-run'], makeFixture());

    expect(result.output).not.toContain(SECRET);
  });
});

describe('backup.sh — garde-fous sur les secrets', () => {
  it("refuse un mot de passe passé par l'environnement", () => {
    // RESTIC_PASSWORD se lit dans /proc/<pid>/environ et dans `systemctl show`.
    const fixture = makeFixture({
      env: ['RESTIC_REPOSITORY=b2:test:/', `RESTIC_PASSWORD=${SECRET}`].join('\n'),
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

  it('refuse un argument inconnu plutôt que de l\'ignorer', () => {
    // Une faute de frappe sur --dry-run lancerait une vraie sauvegarde.
    const result = run('backup.sh', ['--dry-runn'], makeFixture());

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('argument inconnu');
  });
});
