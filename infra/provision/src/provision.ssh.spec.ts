import {
  ADMIN_KEY,
  OTHER_KEY,
  commands,
  exists,
  machine,
  provision,
  put,
  read,
} from './machine';

describe('provision.sh : SSH', () => {
  it('par clé uniquement, root refusé', () => {
    const root = machine();

    const result = provision(root);

    expect(result.status).toBe(0);
    const sshd = read(root, 'etc/ssh/sshd_config.d/00-personal-os.conf');
    expect(sshd).toMatch(/^PasswordAuthentication no$/m);
    expect(sshd).toMatch(/^KbdInteractiveAuthentication no$/m);
    expect(sshd).toMatch(/^AuthenticationMethods publickey$/m);
    expect(sshd).toMatch(/^PermitRootLogin no$/m);
  });

  it('valide la configuration avant de recharger sshd', () => {
    const root = machine();

    provision(root);

    const cmds = commands(root);
    expect(cmds).toContain('sshd -t');
    expect(cmds.indexOf('sshd -t')).toBeLessThan(cmds.indexOf('systemctl try-reload-or-restart ssh'));
  });

  it("refuse une configuration sshd qui n'inclut pas sshd_config.d, avant toute modification", () => {
    const root = machine();
    put(root, 'etc/ssh/sshd_config', 'UsePAM yes\n');

    const result = provision(root);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('sshd_config.d');
    expect(commands(root)).toEqual([]);
  });

  // sshd garde la première valeur lue : une directive contraire, lue avant
  // 00-personal-os.conf, annulerait le durcissement même une fois le fichier
  // en place. Refusé à chaque passage, pas seulement au premier.
  it.each([
    ['dans sshd_config, avant l’Include', 'etc/ssh/sshd_config', 'PermitRootLogin yes\nInclude /etc/ssh/sshd_config.d/*.conf\n'],
    ['dans un fichier de sshd_config.d trié avant le nôtre', 'etc/ssh/sshd_config.d/00-aaa.conf', 'PasswordAuthentication yes\n'],
  ])('refuse une directive contraire lue %s, à chaque passage', (_, file, content) => {
    const root = machine({ provisioned: true });
    put(root, file, content);
    put(root, 'etc/ssh/sshd_config.d/00-personal-os.conf', 'déjà posé par un passage précédent\n');

    for (let passage = 1; passage <= 2; passage++) {
      const result = provision(root);

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(`/${file}: ${content.split('\n')[0]}`);
      expect(commands(root)).toEqual([]);
    }
  });

  it('ignore une directive contraire lue après le nôtre', () => {
    const root = machine({ provisioned: true });
    put(root, 'etc/ssh/sshd_config', 'Include /etc/ssh/sshd_config.d/*.conf\nPermitRootLogin yes\n');
    put(root, 'etc/ssh/sshd_config.d/50-cloud-init.conf', 'PasswordAuthentication yes\n');

    expect(provision(root).status).toBe(0);
  });

  it("sans aucune clé SSH, s'arrête avant de couper l'accès par mot de passe", () => {
    const root = machine({ rootKeys: null });

    const result = provision(root);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/clé SSH/);
    expect(exists(root, 'etc/ssh/sshd_config.d/00-personal-os.conf')).toBe(false);
    expect(commands(root)).toEqual([]);
  });
});

describe("provision.sh : l'utilisateur d'administration", () => {
  it('est créé, sudo sans mot de passe, membre du groupe docker', () => {
    const root = machine();

    provision(root);

    const cmds = commands(root);
    expect(cmds).toContain('useradd --create-home --shell /bin/bash ops');
    expect(cmds).toContain('usermod -aG docker ops');
    expect(read(root, 'etc/sudoers.d/90-ops')).toBe('ops ALL=(ALL) NOPASSWD:ALL\n');
  });

  it('reçoit les clés de root et du compte qui lance sudo, plus celles de --ssh-key', () => {
    const root = machine({ sudoUser: { name: 'ubuntu', keys: `${OTHER_KEY}\n` } });
    const third = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFausseTroisiemeCle000000000000000000 tiers@pc';

    provision(root, ['--ssh-key', third], { SUDO_USER: 'ubuntu' });

    expect(read(root, 'home/ops/.ssh/authorized_keys')).toBe(`${OTHER_KEY}\n${ADMIN_KEY}\n${third}\n`);
    expect(commands(root)).toContain('chown -R ops:ops /home/ops/.ssh');
  });

  // Les images cloud posent pour root une clé bridée (« Please login as the
  // user ubuntu »). Une clé à options n'est jamais recopiée : la recopier sans
  // ses options donnerait à l'administrateur une clé qu'on avait bridée.
  it("ne recopie jamais une clé à options, et garde les clés qu'il a déjà", () => {
    const bridee = `no-port-forwarding,command="echo 'Please login as the user ubuntu'" ${OTHER_KEY}`;
    const root = machine({ rootKeys: `${bridee}\n${ADMIN_KEY}\n` });
    put(root, 'home/ops/.ssh/authorized_keys', `from="10.0.0.1" ${OTHER_KEY}\n`);

    provision(root);

    expect(read(root, 'home/ops/.ssh/authorized_keys')).toBe(`from="10.0.0.1" ${OTHER_KEY}\n${ADMIN_KEY}\n`);
  });

  it('--admin-user choisit son nom', () => {
    const root = machine();

    provision(root, ['--admin-user', 'maxime']);

    expect(commands(root)).toContain('useradd --create-home --shell /bin/bash maxime');
    expect(exists(root, 'home/maxime/.ssh/authorized_keys')).toBe(true);
  });

  it('refuse un nom de compte invalide', () => {
    const result = provision(machine(), ['--admin-user', '../root']);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('--admin-user');
  });
});

describe('provision.sh : arguments', () => {
  it('option inconnue : rien n’est modifié', () => {
    const root = machine();

    const result = provision(root, ['--force']);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('option inconnue');
    expect(exists(root, 'etc/ssh/sshd_config.d/00-personal-os.conf')).toBe(false);
  });

  it('--ssh-key refuse ce qui n’est pas une clé publique', () => {
    const result = provision(machine(), ['--ssh-key', 'pas une clé']);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('--ssh-key');
  });
});
