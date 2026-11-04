import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import { Fixture, makeFixture, run } from './run-script';

/** Un jeton au format quelconque : il ne doit jamais apparaître dans un argument. */
const JETON = 'jeton-etat-qui-ne-doit-jamais-fuiter';
const URL = 'http://127.0.0.1:3001/api/internal/backup-status';

/**
 * Docker, Restic et curl sont les frontières du script : ces tests les
 * remplacent par des doubles pour vérifier ce que l'agent transmet à l'API à
 * la fin de chaque exécution (DASH-3). curl note ses arguments et ce qu'il
 * lit sur son entrée.
 */
function avecDoubles(
  fixture: Fixture,
  options: { restic?: string; curl?: string } = {},
): NodeJS.ProcessEnv {
  const bin = join(fixture.dir, 'bin');
  mkdirSync(bin, { recursive: true });
  const outils: Record<string, string> = {
    docker: 'cat >/dev/null; exit 0',
    restic: options.restic ?? 'exit 0',
    curl: [
      `printf '%s\\n' "$@" >> "${fixture.dir}/curl.args"`,
      `cat >> "${fixture.dir}/curl.stdin"`,
      options.curl ?? 'exit 0',
    ].join('\n'),
  };
  for (const [outil, script] of Object.entries(outils)) {
    const chemin = join(bin, outil);
    writeFileSync(chemin, `#!/usr/bin/env bash\n${script}\n`);
    chmodSync(chemin, 0o755);
  }
  return { PATH: `${bin}:${process.env.PATH}` };
}

function fixtureAvecEtat(url = URL): Fixture {
  const fixture = makeFixture();
  writeFileSync(
    fixture.confPath,
    `${readFileSync(fixture.confPath, 'utf8')}\nBACKUP_PATHS=\nBACKUP_STATUS_URL=${url}\n`,
  );
  writeFileSync(
    fixture.envPath,
    `${readFileSync(fixture.envPath, 'utf8')}\nBACKUP_STATUS_TOKEN=${JETON}\n`,
  );
  return fixture;
}

function transmis(
  fixture: Fixture,
): { args: string[]; stdin: string; corps: Record<string, unknown> } | null {
  const chemin = join(fixture.dir, 'curl.args');
  if (!existsSync(chemin)) return null;
  const args = readFileSync(chemin, 'utf8').trimEnd().split('\n');
  const donnees = args[args.indexOf('--data-binary') + 1];
  return {
    args,
    stdin: readFileSync(join(fixture.dir, 'curl.stdin'), 'utf8'),
    corps: JSON.parse(donnees ?? 'null'),
  };
}

describe("backup.sh — l'état transmis à l'API", () => {
  it('transmet une réussite, avec son heure de fin, au jeton partagé', () => {
    const fixture = fixtureAvecEtat();
    const avant = Date.now();

    const result = run('backup.sh', [], fixture, avecDoubles(fixture));

    expect(result.status).toBe(0);
    const appel = transmis(fixture);
    expect(appel?.args).toContain(URL);
    expect(appel?.corps).toEqual({
      outcome: 'SUCCEEDED',
      finishedAt: expect.any(String),
    });
    const fin = Date.parse(String(appel?.corps['finishedAt']));
    expect(fin).toBeGreaterThanOrEqual(Math.floor(avant / 1000) * 1000);
    expect(fin).toBeLessThanOrEqual(Date.now());
    expect(appel?.stdin).toContain(`Authorization: Bearer ${JETON}`);
  });

  it('ne met jamais le jeton sur la ligne de commande, que `ps` montre à tous', () => {
    const fixture = fixtureAvecEtat();

    run('backup.sh', [], fixture, avecDoubles(fixture));

    expect(transmis(fixture)?.args.join(' ')).not.toContain(JETON);
  });

  it("transmet un échec avec sa cause, en gardant le code d'échec", () => {
    const fixture = fixtureAvecEtat();

    const result = run(
      'backup.sh',
      [],
      fixture,
      avecDoubles(fixture, { restic: '[ "$1" = check ] && exit 3; exit 0' }),
    );

    expect(result.status).not.toBe(0);
    expect(transmis(fixture)?.corps).toEqual({
      outcome: 'FAILED',
      finishedAt: expect.any(String),
      error: expect.stringContaining('restic check'),
    });
  });

  it("vide le transit après un échec, sans perdre le code d'échec", () => {
    const fixture = fixtureAvecEtat();
    const transit = join(fixture.dir, 'tmp');
    mkdirSync(transit);

    const result = run('backup.sh', [], fixture, {
      ...avecDoubles(fixture, { restic: '[ "$1" = check ] && exit 3; exit 0' }),
      TMPDIR: transit,
    });

    expect(result.status).toBe(3);
    expect(readdirSync(transit)).toEqual([]);
  });

  it('transmet aussi le refus d’un contrôle préalable, comme une clé lisible par autrui', () => {
    const fixture = fixtureAvecEtat();
    chmodSync(fixture.passwordPath, 0o644);

    const result = run('backup.sh', [], fixture, avecDoubles(fixture));

    expect(result.status).not.toBe(0);
    expect(transmis(fixture)?.corps).toEqual({
      outcome: 'FAILED',
      finishedAt: expect.any(String),
      error: `clé ${fixture.passwordPath} en mode 644 — attendu 600`,
    });
  });

  it('transmet le refus d’une copie du bucket mal configurée', () => {
    const fixture = fixtureAvecEtat();
    writeFileSync(
      fixture.confPath,
      `${readFileSync(fixture.confPath, 'utf8')}S3_MIRROR_BUCKET=personal-os\n`,
    );

    const result = run('backup.sh', [], fixture, avecDoubles(fixture));

    expect(result.status).not.toBe(0);
    expect(transmis(fixture)?.corps).toMatchObject({
      outcome: 'FAILED',
      error: expect.stringContaining('S3_MIRROR_ENDPOINT absent'),
    });
  });

  it('ne transmet rien en simulation, même quand un contrôle préalable échoue', () => {
    const fixture = fixtureAvecEtat();
    chmodSync(fixture.passwordPath, 0o644);

    const result = run(
      'backup.sh',
      ['--dry-run'],
      fixture,
      avecDoubles(fixture),
    );

    expect(result.status).not.toBe(0);
    expect(transmis(fixture)).toBeNull();
  });

  it('transmet le message d’un arrêt volontaire, tel que le journal le donne', () => {
    const fixture = fixtureAvecEtat();
    const env = avecDoubles(fixture);
    // Le dump se fait, mais pg_restore le refuse.
    writeFileSync(
      join(fixture.dir, 'bin', 'docker'),
      '#!/usr/bin/env bash\ncat >/dev/null; [ "$4" = pg_restore ] && exit 1; exit 0\n',
    );

    const result = run('backup.sh', [], fixture, env);

    expect(result.status).not.toBe(0);
    expect(transmis(fixture)?.corps).toEqual({
      outcome: 'FAILED',
      finishedAt: expect.any(String),
      error:
        'dump de personalos illisible par pg_restore — sauvegarde interrompue',
    });
  });

  it("n'échoue pas la sauvegarde quand l'API est injoignable", () => {
    const fixture = fixtureAvecEtat();

    const result = run(
      'backup.sh',
      [],
      fixture,
      avecDoubles(fixture, { curl: 'exit 7' }),
    );

    expect(result.status).toBe(0);
    expect(transmis(fixture)?.corps).toEqual({
      outcome: 'SUCCEEDED',
      finishedAt: expect.any(String),
    });
  });

  it("ne transmet rien quand aucune adresse n'est configurée", () => {
    const fixture = fixtureAvecEtat('');

    const result = run('backup.sh', [], fixture, avecDoubles(fixture));

    expect(result.status).toBe(0);
    expect(transmis(fixture)).toBeNull();
  });

  it('annonce la transmission dans le plan', () => {
    const fixture = fixtureAvecEtat();

    const result = run('backup.sh', ['--dry-run'], fixture);

    expect(result.stdout).toContain(`plan: état transmis à ${URL}`);
    expect(result.stdout).not.toContain(JETON);
  });
});
