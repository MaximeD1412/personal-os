import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

export const SCRIPT = resolve(__dirname, '..', 'provision.sh');

// Des clés publiques factices : le script n'en lit que la forme.
export const ADMIN_KEY =
  'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFausseCleDeTestPourLAdministrateur0000 admin@portable';
export const OTHER_KEY =
  'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFausseCleDeTestPourUnSecondPoste00000 autre@poste';

export const OS = {
  ubuntu2404: 'ID=ubuntu\nVERSION_ID="24.04"\nVERSION_CODENAME=noble\n',
  ubuntu2204: 'ID=ubuntu\nVERSION_ID="22.04"\nVERSION_CODENAME=jammy\n',
  ubuntu2004: 'ID=ubuntu\nVERSION_ID="20.04"\nVERSION_CODENAME=focal\n',
  debian12: 'ID=debian\nVERSION_ID="12"\nVERSION_CODENAME=bookworm\n',
  debian11: 'ID=debian\nVERSION_ID="11"\nVERSION_CODENAME=bullseye\n',
  rocky9: 'ID=rocky\nVERSION_ID="9.4"\n',
};

// Paquets que le script installe, tels que dpkg les déclarerait.
const PACKAGES = [
  'ca-certificates',
  'curl',
  'jq',
  'sudo',
  'openssh-server',
  'ufw',
  'fail2ban',
  'python3-systemd',
  'unattended-upgrades',
  'docker-ce',
  'docker-ce-cli',
  'containerd.io',
  'docker-buildx-plugin',
  'docker-compose-plugin',
];

const ALLOWED_TUPLES = (any: string) =>
  [
    `### tuple ### allow tcp 22 ${any} any ${any} in`,
    `### tuple ### allow tcp 80 ${any} any ${any} in`,
    `### tuple ### allow tcp 443 ${any} any ${any} in`,
    `### tuple ### allow udp 443 ${any} any ${any} in`,
  ].join('\n') + '\n';

export interface MachineOptions {
  os?: string;
  rootKeys?: string | null;
  sudoUser?: { name: string; keys: string };
  /** La machine a déjà été provisionnée : paquets, compte, pare-feu actif. */
  provisioned?: boolean;
}

/**
 * Une racine factice, comme une machine fraîchement livrée par l'hébergeur :
 * la clé de l'administrateur posée pour root, OpenSSH installé.
 */
export function machine(options: MachineOptions = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'personal-os-provision-'));
  put(root, 'etc/os-release', options.os ?? OS.ubuntu2404);
  put(root, 'etc/ssh/sshd_config', 'Include /etc/ssh/sshd_config.d/*.conf\nUsePAM yes\n');
  put(root, 'etc/passwd', 'root:x:0:0:root:/root:/bin/bash\n');
  put(root, 'etc/group', 'root:x:0:\nsudo:x:27:\n');
  const rootKeys = options.rootKeys === undefined ? `${ADMIN_KEY}\n` : options.rootKeys;
  if (rootKeys !== null) put(root, 'root/.ssh/authorized_keys', rootKeys);
  if (options.sudoUser) {
    put(root, `home/${options.sudoUser.name}/.ssh/authorized_keys`, options.sudoUser.keys);
  }

  const installed = options.provisioned ? PACKAGES : ['openssh-server'];
  put(
    root,
    'var/lib/dpkg/status',
    installed.map((p) => `Package: ${p}\nStatus: install ok installed\n`).join('\n'),
  );

  if (options.provisioned) {
    put(root, 'etc/passwd', 'root:x:0:0:root:/root:/bin/bash\nops:x:1000:1000::/home/ops:/bin/bash\n');
    put(root, 'etc/group', 'root:x:0:\nsudo:x:27:\nops:x:1000:\ndocker:x:999:ops\n');
    put(root, 'usr/bin/docker', '');
    put(root, 'usr/libexec/docker/cli-plugins/docker-compose', '');
    put(root, 'etc/systemd/system/multi-user.target.wants/docker.service', '');
    put(root, 'etc/systemd/system/multi-user.target.wants/fail2ban.service', '');
    put(root, 'etc/default/ufw', 'IPV6=yes\nDEFAULT_INPUT_POLICY="DROP"\nDEFAULT_OUTPUT_POLICY="ACCEPT"\n');
    put(root, 'etc/ufw/ufw.conf', 'ENABLED=yes\nLOGLEVEL=low\n');
    put(root, 'etc/ufw/user.rules', ALLOWED_TUPLES('0.0.0.0/0'));
    put(root, 'etc/ufw/user6.rules', ALLOWED_TUPLES('::/0'));
    put(root, 'etc/ufw/after.rules', '*filter\nCOMMIT\n');
    put(root, 'etc/ufw/after6.rules', '*filter\nCOMMIT\n');
  }
  return root;
}

export function put(root: string, path: string, content: string): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
}

export function read(root: string, path: string): string {
  return readFileSync(join(root, path), 'utf8');
}

export function exists(root: string, path: string): boolean {
  return existsSync(join(root, path));
}

/** Les commandes système que le script aurait lancées, dans l'ordre. */
export function commands(root: string): string[] {
  return exists(root, '.commands') ? read(root, '.commands').split('\n').filter(Boolean) : [];
}

export function forgetCommands(root: string): void {
  writeFileSync(join(root, '.commands'), '');
}

export interface Result {
  status: number;
  stdout: string;
  stderr: string;
}

export function provision(root: string, args: string[] = [], env: NodeJS.ProcessEnv = {}): Result {
  const result = spawnSync('bash', [SCRIPT, ...args, '--root', root], {
    encoding: 'utf8',
    env: { PATH: process.env['PATH'], ...env },
  });
  return { status: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
}
