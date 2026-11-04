import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { Fixture, makeFixture, run } from './run-script';

const SYSTEMD = resolve(__dirname, '..', 'systemd');

const HEURE = 60 * 60 * 1000;

/**
 * Restic est la frontière du système : la campagne d'intégration interroge un
 * vrai dépôt, ces tests-ci simulent sa réponse pour couvrir les cas limites.
 */
function fauxOutil(
  fixture: Fixture,
  outil: string,
  script: string,
): NodeJS.ProcessEnv {
  const bin = join(fixture.dir, 'bin');
  mkdirSync(bin, { recursive: true });
  const chemin = join(bin, outil);
  writeFileSync(chemin, `#!/usr/bin/env bash\n${script}\n`);
  chmodSync(chemin, 0o755);
  return { PATH: `${bin}:${process.env.PATH}` };
}

function fauxRestic(fixture: Fixture, script: string): NodeJS.ProcessEnv {
  return fauxOutil(fixture, 'restic', script);
}

function instantanes(...ages: number[]): string {
  return JSON.stringify(
    ages.map((age, index) => ({
      time: new Date(Date.now() - age).toISOString(),
      tags: ['personal-os'],
      id: `${index}`.repeat(64),
      short_id: `${index}`.repeat(8),
    })),
  );
}

function resticRepond(fixture: Fixture, json: string): NodeJS.ProcessEnv {
  return fauxRestic(fixture, `cat <<'JSON'\n${json}\nJSON`);
}

describe('watch.sh — fraîcheur du dernier instantané', () => {
  it("échoue quand le dernier instantané a plus de 26 heures, pour que l'alerte parte", () => {
    const fixture = makeFixture();

    const result = run(
      'watch.sh',
      [],
      fixture,
      resticRepond(fixture, instantanes(30 * HEURE)),
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('plus de 26 heures');
  });

  it("réussit sans rien signaler quand le dernier instantané a moins de 26 heures", () => {
    const fixture = makeFixture();

    const result = run(
      'watch.sh',
      [],
      fixture,
      resticRepond(fixture, instantanes(25 * HEURE)),
    );

    expect(result.status).toBe(0);
  });

  it('retient le plus récent quand restic rend un instantané par jeu de chemins', () => {
    const fixture = makeFixture();

    const result = run(
      'watch.sh',
      [],
      fixture,
      resticRepond(fixture, instantanes(72 * HEURE, 2 * HEURE, 40 * HEURE)),
    );

    expect(result.status).toBe(0);
  });

  it("échoue quand le dépôt n'a aucun instantané", () => {
    const fixture = makeFixture();

    const result = run('watch.sh', [], fixture, resticRepond(fixture, '[]'));

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('aucun instantané');
  });

  it('échoue quand le dépôt ne répond pas, plutôt que de se taire', () => {
    const fixture = makeFixture();

    const result = run(
      'watch.sh',
      [],
      fixture,
      fauxRestic(fixture, 'echo "Fatal: unable to open repository" >&2; exit 1'),
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('injoignable');
  });

  it('ne regarde que les instantanés de la sauvegarde Personal OS', () => {
    const fixture = makeFixture();
    const env = fauxRestic(fixture, 'printf "%s\\n" "$@" > "$(dirname "$0")/args"; echo "[]"');

    run('watch.sh', [], fixture, env);

    const args = readFileSync(join(fixture.dir, 'bin', 'args'), 'utf8').split(
      '\n',
    );
    expect(args).toEqual(
      expect.arrayContaining(['snapshots', '--tag', 'personal-os', '--latest', '1', '--json']),
    );
  });
});

describe("personal-os-backup-watch — de l'échec à l'alerte", () => {
  it('se déclenche toutes les 6 heures, rattrapées après un arrêt machine', () => {
    const timer = readFileSync(
      join(SYSTEMD, 'personal-os-backup-watch.timer'),
      'utf8',
    );

    expect(timer).toMatch(/^OnCalendar=\*-\*-\* 00\/6:00:00$/m);
    expect(timer).toMatch(/^Persistent=true$/m);
  });

  it("confie son échec à notify-failure.sh, le canal des échecs de sauvegarde", () => {
    const service = readFileSync(
      join(SYSTEMD, 'personal-os-backup-watch.service'),
      'utf8',
    );
    const relais = readFileSync(
      join(SYSTEMD, 'personal-os-backup-failure@.service'),
      'utf8',
    );

    expect(service).toMatch(/^ExecStart=\/opt\/personal-os\/backup\/bin\/watch\.sh$/m);
    expect(service).toMatch(/^OnFailure=personal-os-backup-failure@%n\.service$/m);
    expect(relais).toMatch(/^ExecStart=\/opt\/personal-os\/backup\/bin\/notify-failure\.sh %i$/m);
  });

  it("envoie le courriel d'alerte avec la raison donnée par la vérification", () => {
    const fixture = makeFixture({
      conf: 'BACKUP_ALERT_EMAIL=moi@example.org\nBACKUP_HEARTBEAT_URL=',
    });
    const courriel = join(fixture.dir, 'courriel');
    const verification = run(
      'watch.sh',
      [],
      fixture,
      resticRepond(fixture, instantanes(30 * HEURE)),
    );
    writeFileSync(join(fixture.dir, 'journal'), verification.stderr);
    fauxOutil(fixture, 'journalctl', `cat "${join(fixture.dir, 'journal')}"`);
    const env = fauxOutil(fixture, 'sendmail', `cat > "${courriel}"`);

    const alerte = run(
      'notify-failure.sh',
      ['personal-os-backup-watch.service'],
      fixture,
      env,
    );

    expect(alerte.status).toBe(0);
    const envoye = readFileSync(courriel, 'utf8');
    expect(envoye).toContain('To: moi@example.org');
    expect(envoye).toContain('personal-os-backup-watch.service');
    expect(envoye).toContain('plus de 26 heures');
  });
});
