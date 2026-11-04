import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * La commande de démarrage de l'image de l'API (le CMD du Dockerfile), jouée
 * telle quelle avec des doubles de `node` et de `prisma` qui notent leurs
 * appels. Ce qui compte : la migration ne touche aucune base tant que
 * l'environnement n'est pas vérifié, puisqu'elle précède `main.js` et son
 * propre garde-fou.
 */
const DOCKERFILE = join(__dirname, '..', 'Dockerfile');

function commandeDeDemarrage(): string[] {
  const ligne = readFileSync(DOCKERFILE, 'utf8')
    .split('\n')
    .find((l) => l.startsWith('CMD '));
  if (!ligne) throw new Error('le Dockerfile de l’API n’a pas de CMD');
  return JSON.parse(ligne.slice('CMD '.length)) as string[];
}

describe("démarrage de l'image de l'API", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'demarrage-api-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function demarrer(verificationReussie: boolean) {
    const journal = join(dir, 'journal');
    writeFileSync(journal, '');
    const bin = join(dir, 'bin');
    mkdirSync(bin);
    mkdirSync(join(dir, 'node_modules', '.bin'), { recursive: true });

    const double = (nom: string, statut: string) =>
      `#!/bin/sh\necho "${nom} $*" >>"${journal}"\n${statut}\n`;
    writeFileSync(
      join(bin, 'node'),
      double(
        'node',
        `[ "$1" = verifier-environnement.js ] && exit ${verificationReussie ? 0 : 1}\nexit 0`,
      ),
    );
    writeFileSync(join(dir, 'node_modules', '.bin', 'prisma'), double('prisma', 'exit 0'));
    chmodSync(join(bin, 'node'), 0o755);
    chmodSync(join(dir, 'node_modules', '.bin', 'prisma'), 0o755);

    const [programme, ...args] = commandeDeDemarrage();
    const resultat = spawnSync(programme, args, {
      cwd: dir,
      encoding: 'utf8',
      env: { PATH: `${bin}:/usr/bin:/bin` },
    });
    return {
      statut: resultat.status,
      appels: readFileSync(journal, 'utf8').split('\n').filter(Boolean),
    };
  }

  it("vérifie l'environnement, puis migre, puis démarre", () => {
    const { statut, appels } = demarrer(true);

    expect(statut).toBe(0);
    expect(appels).toEqual([
      'node verifier-environnement.js',
      'prisma migrate deploy',
      'node main.js',
    ]);
  });

  it('ne migre rien et ne démarre pas quand l’environnement est refusé', () => {
    const { statut, appels } = demarrer(false);

    expect(statut).not.toBe(0);
    expect(appels).toEqual(['node verifier-environnement.js']);
  });
});
