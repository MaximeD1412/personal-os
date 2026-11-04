import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BIN } from './run-script';

function genererCle(commentaire: string): string {
  const fichier = join(mkdtempSync(join(tmpdir(), 'personal-os-deploy-key-')), 'cle');
  spawnSync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', commentaire, '-f', fichier]);
  return readFileSync(`${fichier}.pub`, 'utf8').trim();
}

const CLE_PROD = genererCle('operateur@poste');
const CLE_STAGING = genererCle('operateur@poste');

const OPTIONS = 'no-pty,no-port-forwarding,no-agent-forwarding,no-X11-forwarding,restrict';

function cles(fichiers: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'personal-os-deploy-keys-'));
  for (const [nom, contenu] of Object.entries(fichiers)) {
    writeFileSync(join(dir, nom), contenu);
  }
  return dir;
}

function imprimer(quoi: string, args: string[] = []) {
  const resultat = spawnSync(join(BIN, 'install-access.sh'), ['--print', quoi, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return {
    status: resultat.status ?? 1,
    stdout: resultat.stdout ?? '',
    stderr: resultat.stderr ?? '',
  };
}

function lignesDeCles(stdout: string): string[] {
  return stdout.split('\n').filter((ligne) => ligne !== '' && !ligne.startsWith('#'));
}

describe('install-access.sh --print authorized_keys', () => {
  it('force chaque clé sur deploy-trigger de son environnement, sans pty ni redirection', () => {
    const dir = cles({ 'prod.pub': `${CLE_PROD}\n`, 'staging.pub': `${CLE_STAGING}\n` });

    const resultat = imprimer('authorized_keys', ['--keys', dir]);

    expect(resultat.status).toBe(0);
    const [type, corps] = CLE_PROD.split(' ');
    const [typeS, corpsS] = CLE_STAGING.split(' ');
    expect(lignesDeCles(resultat.stdout)).toEqual([
      `command="/opt/personal-os/deploy/bin/deploy-trigger prod",${OPTIONS} ${type} ${corps} personal-os-deploy-prod`,
      `command="/opt/personal-os/deploy/bin/deploy-trigger staging",${OPTIONS} ${typeS} ${corpsS} personal-os-deploy-staging`,
    ]);
  });

  it('suit le préfixe de l’agent', () => {
    const dir = cles({ 'staging.pub': CLE_STAGING });

    const resultat = imprimer('authorized_keys', ['--keys', dir, '--prefix', '/srv/agent']);

    expect(lignesDeCles(resultat.stdout)[0]).toMatch(
      /^command="\/srv\/agent\/bin\/deploy-trigger staging",/
    );
  });

  it('ne pose que les clés fournies, et le dit pour celle qui manque', () => {
    const dir = cles({ 'staging.pub': CLE_STAGING });

    const resultat = imprimer('authorized_keys', ['--keys', dir]);

    expect(resultat.status).toBe(0);
    expect(lignesDeCles(resultat.stdout)).toHaveLength(1);
    expect(lignesDeCles(resultat.stdout)[0]).toContain('deploy-trigger staging');
    expect(resultat.stderr).toContain('prod.pub');
  });

  it.each([
    ['des options qui précèdent la clé', `command="/bin/sh",no-pty ${CLE_PROD}`],
    ['deux clés dans le même fichier', `${CLE_PROD}\n${CLE_STAGING}\n`],
    ['une clé privée', '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXk=\n'],
    ['un fichier vide', ''],
    ['un corps qui n’est pas du base64', 'ssh-ed25519 AAAA"C3Nz'],
  ])('refuse %s, sans rien imprimer', (_cas, contenu) => {
    const dir = cles({ 'prod.pub': contenu, 'staging.pub': CLE_STAGING });

    const resultat = imprimer('authorized_keys', ['--keys', dir]);

    expect(resultat.status).not.toBe(0);
    expect(resultat.stdout).toBe('');
    expect(resultat.stderr).toContain('prod.pub');
  });

  it('refuse la même clé pour les deux environnements', () => {
    const dir = cles({ 'prod.pub': CLE_PROD, 'staging.pub': `${CLE_PROD.split(' ').slice(0, 2).join(' ')} autre` });

    const resultat = imprimer('authorized_keys', ['--keys', dir]);

    expect(resultat.status).not.toBe(0);
    expect(resultat.stdout).toBe('');
    expect(resultat.stderr).toContain('une clé par environnement');
  });

  it('refuse un préfixe qui casserait la commande forcée', () => {
    const dir = cles({ 'staging.pub': CLE_STAGING });

    const resultat = imprimer('authorized_keys', ['--keys', dir, '--prefix', '/srv/a" b']);

    expect(resultat.status).not.toBe(0);
    expect(resultat.stdout).toBe('');
  });
});

describe('install-access.sh --print sudoers', () => {
  it("n'ouvre à deploy que deploy-trigger, pour ses deux environnements, en gardant la commande SSH", () => {
    const resultat = imprimer('sudoers');

    expect(resultat.status).toBe(0);
    const regles = resultat.stdout.split('\n').filter((ligne) => ligne !== '' && !ligne.startsWith('#'));
    expect(regles).toEqual([
      'Defaults!/opt/personal-os/deploy/bin/deploy-trigger env_keep += "SSH_ORIGINAL_COMMAND"',
      'deploy ALL=(root) NOPASSWD: /opt/personal-os/deploy/bin/deploy-trigger prod, /opt/personal-os/deploy/bin/deploy-trigger staging',
    ]);
  });
});
