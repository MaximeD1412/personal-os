import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const LIB = resolve(__dirname, '..', 'lib', 'common.sh');
const MARQUE = 'PostgreSQL init process complete';

/**
 * Appelle `conteneur_initialise` avec un `docker` de paille.
 *
 * Le vrai binaire n'est pas nécessaire : ce qui est en jeu ici n'est pas
 * Docker, c'est la façon dont le journal est lu. Le script de paille écrit ce
 * qu'on lui dit, et la campagne tourne partout, tout de suite.
 */
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
    // `pg_isready` répondrait « prêt » ici : c'est le serveur **temporaire** de
    // l'initialisation, que l'image éteint juste après.
    expect(
      conteneurInitialise(
        `printf '%s\\n' 'LOG: database system is ready to accept connections'`,
      ),
    ).not.toBe(0);
  });

  it('reste vrai quand le journal continue de grossir pendant la lecture', () => {
    // C'est la régression, et elle a coûté un déploiement à l'aveugle.
    //
    // `docker logs … | grep -q` sortait à la première correspondance ; postgres
    // écrivant sa ligne suivante juste après, le producteur prenait EPIPE et
    // `pipefail` faisait rendre 141 au tube — un échec, alors que la marque
    // était bien là. Selon le moment, le même appel rendait 0 ou 141.
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
    // `docker logs` sur un conteneur supprimé rend une erreur : la traiter
    // comme « pas encore prêt » vaut mieux que la laisser passer pour un succès.
    expect(
      conteneurInitialise('echo "No such container" >&2; exit 1'),
    ).not.toBe(0);
  });
});
