import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Fixture, makeFixture, run } from './run-script';

const HEURE = 60 * 60 * 1000;

/**
 * La vérification interroge un vrai dépôt Restic : c'est le format de sa
 * réponse, pas celui qu'on imagine, qui décide si l'alerte part.
 */
describe('watch.sh sur un vrai dépôt Restic', () => {
  let fixture: Fixture;
  let repoDir: string;
  let sourceDir: string;

  function restic(args: string[]): string {
    return execFileSync('restic', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        RESTIC_REPOSITORY: repoDir,
        RESTIC_PASSWORD_FILE: fixture.passwordPath,
        TZ: 'UTC',
      },
    });
  }

  /** Un instantané comme ceux de backup.sh, daté dans le passé. */
  function instantane(age: number): void {
    const date = new Date(Date.now() - age);
    const horodatage = date.toISOString().slice(0, 19).replace('T', ' ');
    restic([
      'backup',
      '--tag',
      'personal-os',
      // --time s'entend en heure locale : on le fixe en UTC.
      '--time',
      horodatage,
      sourceDir,
    ]);
  }

  beforeEach(() => {
    repoDir = mkdtempSync(join(tmpdir(), 'restic-watch-repo-'));
    sourceDir = mkdtempSync(join(tmpdir(), 'restic-watch-source-'));
    writeFileSync(join(sourceDir, 'personalos.dump'), 'contenu');

    fixture = makeFixture();
    writeFileSync(
      fixture.envPath,
      [
        `RESTIC_REPOSITORY=${repoDir}`,
        `RESTIC_PASSWORD_FILE=${fixture.passwordPath}`,
      ].join('\n'),
    );
    restic(['init']);
  });

  afterEach(() => {
    for (const dir of [repoDir, sourceDir, fixture.dir]) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("échoue, pour que l'alerte parte, sur un dépôt sans aucun instantané", () => {
    const result = run('watch.sh', [], fixture);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('aucun instantané');
  });

  it("échoue, pour que l'alerte parte, quand le dernier instantané a plus de 26 heures", () => {
    instantane(50 * HEURE);
    instantane(27 * HEURE);

    const result = run('watch.sh', [], fixture);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('plus de 26 heures');
  });

  it('réussit sans rien signaler avec un instantané de moins de 26 heures', () => {
    instantane(50 * HEURE);
    instantane(25 * HEURE);

    const result = run('watch.sh', [], fixture);

    expect(result.status).toBe(0);
  });
});
