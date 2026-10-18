import {
  commands,
  exists,
  machine,
  provision,
  put,
  read,
} from './machine';

describe('provision.sh : pare-feu', () => {
  function ufw(root: string): string[] {
    return commands(root).filter((c) => c.startsWith('ufw '));
  }

  it("n'ouvre que 22, 80 et 443, et s'active en dernier", () => {
    const root = machine();

    provision(root);

    const rules = ufw(root);
    expect(rules).toContain('ufw default deny incoming');
    expect(rules.filter((c) => c.startsWith('ufw allow '))).toEqual([
      'ufw allow 22/tcp',
      'ufw allow 80/tcp',
      'ufw allow 443/tcp',
      'ufw allow 443/udp',
    ]);
    expect(rules.at(-1)).toBe('ufw --force enable');
  });

  // Docker publie ses ports par DNAT, avant les règles d'entrée d'ufw : sans
  // ce bloc, un `ports: "5432:5432"` serait ouvert sur Internet.
  it('ne laisse joindre de dehors que les ports 80 et 443 publiés par Docker', () => {
    const root = machine();
    put(root, 'etc/ufw/after.rules', '*filter\n:ufw-after-input - [0:0]\nCOMMIT\n');

    provision(root);

    const rules = read(root, 'etc/ufw/after.rules');
    expect(rules.startsWith('*filter\n:ufw-after-input - [0:0]\nCOMMIT\n')).toBe(true);
    const chain = rules.slice(rules.indexOf('# BEGIN PERSONAL-OS DOCKER-USER'));
    expect(chain).toContain(':DOCKER-USER - [0:0]');
    expect(chain).toContain('-A DOCKER-USER -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN');
    expect(chain).toContain('-A DOCKER-USER -i docker0 -j RETURN');
    expect(chain).toContain('-A DOCKER-USER -i br-+ -j RETURN');
    const ouvertures = chain.split('\n').filter((l) => l.includes('--ctorigdstport'));
    expect(ouvertures).toEqual([
      '-A DOCKER-USER -p tcp -m conntrack --ctorigdstport 80 --ctdir ORIGINAL -j RETURN',
      '-A DOCKER-USER -p tcp -m conntrack --ctorigdstport 443 --ctdir ORIGINAL -j RETURN',
      '-A DOCKER-USER -p udp -m conntrack --ctorigdstport 443 --ctdir ORIGINAL -j RETURN',
    ]);
    expect(chain).toMatch(/-A DOCKER-USER -j DROP\nCOMMIT\n# END PERSONAL-OS DOCKER-USER\n$/);
  });

  it('applique les mêmes règles en IPv6', () => {
    const root = machine();

    provision(root);

    const v4 = read(root, 'etc/ufw/after.rules');
    expect(read(root, 'etc/ufw/after6.rules')).toBe(v4);
  });

  it('relancé, ne duplique pas le bloc DOCKER-USER', () => {
    const root = machine({ provisioned: true });
    provision(root);
    const once = read(root, 'etc/ufw/after.rules');

    provision(root);

    expect(read(root, 'etc/ufw/after.rules')).toBe(once);
    expect(once.match(/BEGIN PERSONAL-OS DOCKER-USER/g)).toHaveLength(1);
  });

  // En IPv6, Docker relaie un port publié par docker-proxy (INPUT) : une
  // autorisation ufw sur 8080 ouvrirait aussi un conteneur publié sur 8080.
  // La machine est partagée : la règle n'est pas retirée en silence, le
  // passage est refusé avant toute modification.
  it.each([
    ['un port', '### tuple ### allow tcp 8080 0.0.0.0/0 any 0.0.0.0/0 in'],
    ['un port en IPv6', '### tuple ### allow tcp 8080 ::/0 any ::/0 in'],
    ['une interface', '### tuple ### allow any any 0.0.0.0/0 any 0.0.0.0/0 in_wg0'],
    ['un routage', '### tuple ### route:allow tcp 5432 0.0.0.0/0 any 0.0.0.0/0 in'],
  ])('refuse une autorisation ufw sur %s hors de 22, 80 et 443, avant toute modification', (_, rule) => {
    const root = machine({ provisioned: true });
    const file = rule.includes('::/0') ? 'etc/ufw/user6.rules' : 'etc/ufw/user.rules';
    put(root, file, `${read(root, file)}${rule}\n`);

    const result = provision(root);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(rule.replace('### tuple ### ', ''));
    expect(result.stderr).toContain('ufw delete');
    expect(commands(root)).toEqual([]);
    expect(exists(root, 'etc/ssh/sshd_config.d/00-personal-os.conf')).toBe(false);
  });

  it('--dry-run annonce le refus et montre le plan quand même, avec un code non nul', () => {
    const root = machine({ provisioned: true });
    put(root, 'etc/ufw/user.rules', `${read(root, 'etc/ufw/user.rules')}### tuple ### allow tcp 8080 0.0.0.0/0 any 0.0.0.0/0 in\n`);

    const result = provision(root, ['--dry-run']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('le passage réel refusera');
    expect(result.stdout).toContain('/etc/ssh/sshd_config.d/00-personal-os.conf');
  });

  it("une fois actif, se recharge quand ses règles changent, sans s'activer à nouveau", () => {
    const root = machine({ provisioned: true });

    provision(root);

    expect(ufw(root)).toEqual(['ufw reload']);
  });
});
