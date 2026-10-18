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

  // Dans un bloc Match, une directive remplace la valeur globale pour les
  // connexions qu'il désigne, même lue après 00-personal-os.conf.
  it.each([
    [
      'dans sshd_config, après l’Include',
      'etc/ssh/sshd_config',
      'Include /etc/ssh/sshd_config.d/*.conf\nMatch User root\n  PermitRootLogin yes\n',
      '  PermitRootLogin yes (bloc Match)',
    ],
    [
      'dans un fichier de sshd_config.d trié après le nôtre',
      'etc/ssh/sshd_config.d/60-exceptions.conf',
      'Match Address 10.0.0.0/8\n  PasswordAuthentication yes\n',
      '  PasswordAuthentication yes (bloc Match)',
    ],
  ])('refuse une exception Match contraire %s, à chaque passage', (_, file, content, line) => {
    const root = machine({ provisioned: true });
    put(root, file, content);

    for (let passage = 1; passage <= 2; passage++) {
      const result = provision(root);

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(`/${file}: ${line}`);
      expect(commands(root)).toEqual([]);
    }
  });

  // OpenSSH accepte « = » comme séparateur, et des guillemets autour de la
  // valeur : l'exception doit être reconnue sous toutes ses formes.
  it.each([
    ['Match Address 203.0.113.0/24\nPermitRootLogin=yes\n', 'PermitRootLogin=yes'],
    ['Match Address 203.0.113.0/24\n  PermitRootLogin = yes\n', '  PermitRootLogin = yes'],
    ['Match=User root\n\tPermitRootLogin "prohibit-password"\n', '\tPermitRootLogin "prohibit-password"'],
    ['Match User ops\n  AuthenticationMethods publickey password\n', '  AuthenticationMethods publickey password'],
    // Le mot-clé lui-même peut être entre guillemets (strdelim d'OpenSSH).
    ['"Match" Address 203.0.113.0/24\nPermitRootLogin=yes\n', 'PermitRootLogin=yes'],
    ['Match Address 203.0.113.0/24\n"PermitRootLogin" yes\n', '"PermitRootLogin" yes'],
  ])('refuse l’exception %j, à chaque passage', (content, line) => {
    const root = machine({ provisioned: true });
    put(root, 'etc/ssh/sshd_config.d/60-exceptions.conf', content);

    for (let passage = 1; passage <= 2; passage++) {
      const result = provision(root);

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(`/etc/ssh/sshd_config.d/60-exceptions.conf: ${line} (bloc Match)`);
      expect(commands(root)).toEqual([]);
    }
  });

  // Un fichier inclus ailleurs que sshd_config.d/*.conf ne serait pas
  // contrôlé : l'Include lui-même fait refuser la machine.
  it.each([
    ['à la fin de sshd_config', 'etc/ssh/sshd_config', 'Include /etc/ssh/sshd_config.d/*.conf\nInclude /etc/ssh/root-exception.conf\n', 'Include /etc/ssh/root-exception.conf'],
    ['avec « = » et un chemin relatif', 'etc/ssh/sshd_config', 'Include /etc/ssh/sshd_config.d/*.conf\nInclude=sshd_config.d/*.conf\n', 'Include=sshd_config.d/*.conf'],
    // OpenSSH passe le chemin tel quel à glob : SSHD_CONFIG.D est un autre
    // dossier, qui ne serait pas contrôlé.
    ['dont seule la casse diffère du standard', 'etc/ssh/sshd_config', 'Include /etc/ssh/sshd_config.d/*.conf\nInclude /etc/ssh/SSHD_CONFIG.D/*.CONF\n', 'Include /etc/ssh/SSHD_CONFIG.D/*.CONF'],
    ['depuis un fichier de sshd_config.d', 'etc/ssh/sshd_config.d/60-renvoi.conf', 'Include /etc/ssh/autres/*.conf\n', 'Include /etc/ssh/autres/*.conf'],
    // OpenSSH découpe le mot-clé avec strdelim : un passage entre guillemets
    // s'y recolle, et un « = » en tête de ligne est sauté.
    ['au mot-clé entre guillemets', 'etc/ssh/sshd_config', 'Include /etc/ssh/sshd_config.d/*.conf\n"Include" /etc/ssh/root-exception.conf\n', '"Include" /etc/ssh/root-exception.conf'],
    ['au mot-clé en partie entre guillemets', 'etc/ssh/sshd_config', 'Include /etc/ssh/sshd_config.d/*.conf\nInc"lude" /etc/ssh/root-exception.conf\n', 'Inc"lude" /etc/ssh/root-exception.conf'],
    ['au mot-clé précédé d’un passage vide entre guillemets', 'etc/ssh/sshd_config', 'Include /etc/ssh/sshd_config.d/*.conf\n""Include"" /etc/ssh/root-exception.conf\n', '""Include"" /etc/ssh/root-exception.conf'],
    ['précédé d’un « = »', 'etc/ssh/sshd_config', 'Include /etc/ssh/sshd_config.d/*.conf\n= Include /etc/ssh/root-exception.conf\n', '= Include /etc/ssh/root-exception.conf'],
  ])('refuse un Include %s, à chaque passage', (_, file, content, line) => {
    const root = machine({ provisioned: true });
    put(root, file, content);
    put(root, 'etc/ssh/root-exception.conf', 'Match Address 203.0.113.0/24\nPermitRootLogin=yes\n');

    for (let passage = 1; passage <= 2; passage++) {
      const result = provision(root);

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(`/${file}: ${line} (Include non pris en charge)`);
      expect(commands(root)).toEqual([]);
    }
  });

  it('reconnaît « = » aussi avant l’Include', () => {
    const root = machine({ provisioned: true });
    put(root, 'etc/ssh/sshd_config', 'PasswordAuthentication=yes\nInclude /etc/ssh/sshd_config.d/*.conf\n');

    const result = provision(root);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('/etc/ssh/sshd_config: PasswordAuthentication=yes');
  });

  it('reconnaît un mot-clé entre guillemets avant l’Include', () => {
    const root = machine({ provisioned: true });
    put(root, 'etc/ssh/sshd_config', '"PermitRootLogin" yes\nInclude /etc/ssh/sshd_config.d/*.conf\n');

    const result = provision(root);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('/etc/ssh/sshd_config: "PermitRootLogin" yes');
  });

  // sshd compte \r parmi les blancs : un fichier aux fins de ligne Windows
  // garde l'Include standard.
  it('accepte un sshd_config aux fins de ligne CRLF', () => {
    const root = machine({ provisioned: true });
    put(root, 'etc/ssh/sshd_config', 'Include /etc/ssh/sshd_config.d/*.conf\r\nPermitRootLogin no\r\n');

    expect(provision(root).status).toBe(0);
  });

  it('accepte un bloc Match qui ne touche pas au durcissement', () => {
    const root = machine({ provisioned: true });
    put(
      root,
      'etc/ssh/sshd_config',
      'Include /etc/ssh/sshd_config.d/*.conf\nMatch User sftp\n  ForceCommand internal-sftp\n  PermitRootLogin=no\n  AuthenticationMethods "publickey"\n',
    );

    expect(provision(root).status).toBe(0);
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

  // sshd ignore les commentaires d'authorized_keys : un fichier qui n'a plus
  // que des commentaires ne donne aucun accès.
  it("s'arrête aussi quand les clés de l'administrateur ne sont que des commentaires", () => {
    const root = machine({ rootKeys: null });
    put(root, 'home/ops/.ssh/authorized_keys', '# clé retirée\n  # ssh-ed25519 AAAAancienne ancien@poste\n');

    const result = provision(root);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/clé SSH/);
    expect(exists(root, 'etc/ssh/sshd_config.d/00-personal-os.conf')).toBe(false);
    expect(commands(root)).toEqual([]);
  });

  it("garde une clé à options de l'administrateur comme clé utilisable", () => {
    const root = machine({ rootKeys: null });
    put(root, 'home/ops/.ssh/authorized_keys', `# poste principal\nfrom="192.0.2.0/24" ${ADMIN_KEY}\n`);

    expect(provision(root).status).toBe(0);
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
