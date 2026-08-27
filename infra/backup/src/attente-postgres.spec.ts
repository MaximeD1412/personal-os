import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const LIB = resolve(__dirname, '..', 'lib', 'common.sh');
const MARQUE = 'PostgreSQL init process complete';

function conteneurInitialise(journal: string): number {
  const dir = mkdtempSync(join(tmpdir(), 'faux-docker-'));
  const faux = join(dir, 'docker');

  writeFileSync(faux, `#!/usr/bin/env bash\n${journal}\n`);
  chmodSync(faux, 0o755);

  try {
    execFileSync(
      'bash',
      ['-c', `set -euo pipefail; . "${LIB}"; conteneur_initialise essai`],
      {
        env: { ...process.env, PATH: `${dir}:${process.env['PATH']}` },
        stdio: 'ignore',
      },
    );
    return 0;
  } catch (error) {
    return (error as { status?: number }).status ?? 1;
  }
}

describe('conteneur_initialise', () => {
  it("reconnaît la marque de fin d'initialisation", () => {
    expect(
      conteneurInitialise(`printf '%s\\n' 'LOG: shutting down' '${MARQUE}'`),
    ).toBe(0);
  });

  it("reste faux tant que la marque n'est pas là", () => {
    expect(
      conteneurInitialise(
        `printf '%s\\n' 'LOG: database system is ready to accept connections'`,
      ),
    ).not.toBe(0);
  });

  it('reste vrai quand le journal continue de grossir pendant la lecture', () => {
    expect(
      conteneurInitialise(
        [
          `printf '%s\\n' 'LOG: shutting down' '${MARQUE}'`,
          'sleep 0.2',
          `printf '%s\\n' 'LOG: database system is ready to accept connections'`,
        ].join('\n'),
      ),
    ).toBe(0);
  });

  it('reste faux quand le conteneur a disparu', () => {
    expect(
      conteneurInitialise('echo "No such container" >&2; exit 1'),
    ).not.toBe(0);
  });
});
