import {
  commands,
  exists,
  forgetCommands,
  machine,
  provision,
  read,
} from './machine';

describe('provision.sh : idempotence', () => {
  it('deux exécutions de suite : la seconde ne change rien', () => {
    const root = machine({ provisioned: true });
    provision(root);
    const files = [
      'etc/ssh/sshd_config.d/00-personal-os.conf',
      'etc/fail2ban/jail.d/personal-os.local',
      'etc/apt/apt.conf.d/20auto-upgrades',
      'etc/docker/daemon.json',
      'etc/ufw/after.rules',
      'home/ops/.ssh/authorized_keys',
      'etc/sudoers.d/90-ops',
    ];
    const before = files.map((f) => read(root, f));
    forgetCommands(root);

    const second = provision(root);

    expect(second.status).toBe(0);
    expect(commands(root)).toEqual([]);
    expect(files.map((f) => read(root, f))).toEqual(before);
    expect(second.stdout).toContain('Aucun changement');
  });

  it('la première exécution liste ce qu’elle a changé', () => {
    const result = provision(machine());

    expect(result.stdout).toContain('/etc/ssh/sshd_config.d/00-personal-os.conf');
    expect(result.stdout).not.toContain('Aucun changement');
  });
});

describe('provision.sh : --dry-run', () => {
  it("annonce ce qui changerait sans rien écrire ni rien lancer", () => {
    const root = machine();

    const result = provision(root, ['--dry-run']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('/etc/ssh/sshd_config.d/00-personal-os.conf');
    expect(result.stdout).toContain('+PermitRootLogin no');
    expect(result.stdout).toContain('ufw --force enable');
    expect(exists(root, 'etc/ssh/sshd_config.d/00-personal-os.conf')).toBe(false);
    expect(commands(root)).toEqual([]);
  });
});
