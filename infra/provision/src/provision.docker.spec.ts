import { rmSync } from 'node:fs';
import { join } from 'node:path';

import {
  OS,
  commands,
  exists,
  machine,
  provision,
  put,
  read,
} from './machine';

describe('provision.sh : fail2ban et mises à jour', () => {
  it('fail2ban surveille SSH par le journal systemd, sous le nom d’unité de Debian et Ubuntu', () => {
    const root = machine();

    provision(root);

    const jail = read(root, 'etc/fail2ban/jail.d/personal-os.local');
    expect(jail).toMatch(/\[sshd\]\nenabled = true\nbackend = systemd\n/);
    expect(jail).toMatch(/^journalmatch = .*_SYSTEMD_UNIT=ssh\.service .*_COMM=sshd-session$/m);
    expect(commands(root)).toContain('systemctl enable --now fail2ban');
  });

  it('les mises à jour de sécurité sont automatiques', () => {
    const root = machine();

    provision(root);

    const auto = read(root, 'etc/apt/apt.conf.d/20auto-upgrades');
    expect(auto).toContain('APT::Periodic::Update-Package-Lists "1";');
    expect(auto).toContain('APT::Periodic::Unattended-Upgrade "1";');
    const policy = read(root, 'etc/apt/apt.conf.d/52personal-os-unattended-upgrades');
    expect(policy).toContain('Unattended-Upgrade::Automatic-Reboot "true";');
    expect(policy).toContain('Unattended-Upgrade::Automatic-Reboot-Time "05:00";');
  });

  it('installe les paquets manquants, et seulement eux', () => {
    const root = machine();

    provision(root);

    const install = commands(root).find((c) => c.startsWith('apt-get install') && c.includes('ufw'));
    for (const pkg of ['ufw', 'fail2ban', 'python3-systemd', 'unattended-upgrades', 'sudo', 'jq']) {
      expect(install).toContain(` ${pkg}`);
    }
    expect(install).not.toContain('openssh-server');
  });
});

describe('provision.sh : Docker', () => {
  it('installé depuis le dépôt officiel, avec Compose', () => {
    const root = machine();

    provision(root);

    expect(read(root, 'etc/apt/sources.list.d/docker.list')).toMatch(
      /^deb \[arch=(amd64|arm64) signed-by=\/etc\/apt\/keyrings\/docker\.asc\] https:\/\/download\.docker\.com\/linux\/ubuntu noble stable$/m,
    );
    const install = commands(root).find((c) => c.includes('docker-ce '));
    expect(install).toContain(' docker-compose-plugin');
    expect(commands(root)).toContain(
      'curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc',
    );
  });

  it('pose sa configuration avant de l’installer : journaux bornés, live-restore', () => {
    const root = machine();

    provision(root);

    const daemon = JSON.parse(read(root, 'etc/docker/daemon.json'));
    expect(daemon['log-opts']).toEqual({ 'max-size': '10m', 'max-file': '3' });
    expect(daemon['live-restore']).toBe(true);
  });

  // Redémarrer dockerd couperait tous les conteneurs de la machine, y
  // compris ceux des autres projets. live-restore se recharge à chaud ; les
  // journaux bornés s'appliquent au prochain démarrage naturel.
  it('déjà installé : garde ses paquets et sa configuration, recharge sans redémarrer', () => {
    const root = machine({ provisioned: true });
    put(root, 'etc/docker/daemon.json', '{ "data-root": "/srv/docker" }\n');

    provision(root);

    const cmds = commands(root);
    expect(exists(root, 'etc/apt/sources.list.d/docker.list')).toBe(false);
    expect(cmds.some((c) => c.includes('docker-ce'))).toBe(false);
    expect(JSON.parse(read(root, 'etc/docker/daemon.json'))['data-root']).toBe('/srv/docker');
    expect(cmds).toContain('systemctl reload docker');
    expect(cmds.some((c) => c.includes('restart docker'))).toBe(false);
  });

  it('installe Compose quand Docker vient du dépôt officiel sans lui', () => {
    const root = machine({ provisioned: true });
    rmSync(join(root, 'usr/libexec/docker/cli-plugins/docker-compose'));

    provision(root);

    expect(commands(root)).toContain('apt-get install -y docker-compose-plugin');
  });
});

describe('provision.sh : systèmes pris en charge', () => {
  it('Debian 12 : Docker depuis le dépôt Debian', () => {
    const root = machine({ os: OS.debian12 });

    expect(provision(root).status).toBe(0);
    expect(read(root, 'etc/apt/sources.list.d/docker.list')).toContain(
      'https://download.docker.com/linux/debian bookworm stable',
    );
  });

  it('Ubuntu 22.04 est accepté', () => {
    expect(provision(machine({ os: OS.ubuntu2204 })).status).toBe(0);
  });

  it.each([
    ['Ubuntu 20.04', OS.ubuntu2004],
    ['Debian 11', OS.debian11],
    ['Rocky 9', OS.rocky9],
  ])('%s est refusé avant toute modification', (_, os) => {
    const root = machine({ os });

    const result = provision(root);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Debian 12+ ou Ubuntu 22.04+');
    expect(commands(root)).toEqual([]);
    expect(exists(root, 'etc/ssh/sshd_config.d/00-personal-os.conf')).toBe(false);
  });
});
