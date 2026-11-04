import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BIN } from './run-script';

const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';

/**
 * Un `sudo` qui note ce qu'on lui demande au lieu de l'exécuter : le
 * déclencheur, lancé sans privilège, se relance par lui une fois la commande
 * acceptée. Tout ce qui est refusé doit l'être avant.
 */
function banc(): { faux: string; sudo: string } {
  const dir = mkdtempSync(join(tmpdir(), 'personal-os-deploy-trigger-'));
  const faux = join(dir, 'faux');
  mkdirSync(faux);
  const sudo = join(dir, 'sudo.log');
  writeFileSync(
    join(faux, 'sudo'),
    `#!/usr/bin/env bash\nprintf '%s\\n' "$*" "SSH_ORIGINAL_COMMAND=$SSH_ORIGINAL_COMMAND" >"${sudo}"\n`
  );
  chmodSync(join(faux, 'sudo'), 0o755);
  return { faux, sudo };
}

function declencher(args: string[], commande: string | undefined) {
  const { faux, sudo } = banc();
  const env: NodeJS.ProcessEnv = { ...process.env, PATH: `${faux}:${process.env.PATH}` };
  delete env.SSH_ORIGINAL_COMMAND;
  if (commande !== undefined) env.SSH_ORIGINAL_COMMAND = commande;

  const resultat = spawnSync(join(BIN, 'deploy-trigger'), args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
  });
  return {
    status: resultat.status ?? 1,
    stderr: resultat.stderr ?? '',
    eleve: existsSync(sudo) ? readFileSync(sudo, 'utf8') : null,
  };
}

describe('deploy-trigger — ce que la clé refuse', () => {
  function refus(args: string[], commande: string | undefined): string {
    const resultat = declencher(args, commande);
    expect(resultat.status).not.toBe(0);
    expect(resultat.eleve).toBeNull();
    return resultat.stderr;
  }

  it('refuse une commande quelconque', () => {
    expect(refus(['staging'], 'ls')).toContain('refusé');
  });

  it('refuse une session sans commande', () => {
    expect(refus(['staging'], undefined)).toContain('refusé');
  });

  it("refuse l'environnement d'une autre clé", () => {
    expect(refus(['staging'], `deploy prod ${SHA}`)).toContain('ne déploie que staging');
    expect(refus(['prod'], `deploy staging ${SHA}`)).toContain('ne déploie que prod');
  });

  it.each([
    ['trop court', SHA.slice(0, 39)],
    ['trop long', `${SHA}0`],
    ['en majuscules', SHA.toUpperCase()],
    ['une branche', 'develop'],
  ])('refuse un commit %s', (_cas, commit) => {
    expect(refus(['staging'], `deploy staging ${commit}`)).toContain('40 caractères hexadécimaux');
  });

  it.each([
    ['une seconde commande', `deploy staging ${SHA}; ls`],
    ['une seconde ligne', `deploy staging ${SHA}\nls`],
    ['un argument de plus', `deploy staging ${SHA} --dry-run`],
    ['des espaces en trop', `deploy  staging ${SHA}`],
  ])('refuse %s', (_cas, commande) => {
    refus(['staging'], commande);
  });

  it("refuse un environnement de clé inconnu, ou absent d'authorized_keys", () => {
    expect(refus(['demo'], `deploy demo ${SHA}`)).toContain('environnement de clé inconnu');
    refus([], `deploy staging ${SHA}`);
    refus(['staging', 'prod'], `deploy staging ${SHA}`);
  });
});

describe('deploy-trigger — ce que la clé accepte', () => {
  it('se relance en root par sudo, pour son seul environnement, la commande intacte', () => {
    const resultat = declencher(['staging'], `deploy staging ${SHA}`);

    expect(resultat.status).toBe(0);
    expect(resultat.eleve).toBe(
      `-n -- ${join(BIN, 'deploy-trigger')} staging\nSSH_ORIGINAL_COMMAND=deploy staging ${SHA}\n`
    );
  });
});
