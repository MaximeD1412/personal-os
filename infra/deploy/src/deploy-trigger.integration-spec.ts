import { spawnSync } from 'node:child_process';

import { requireTool, sh, silence, SOURCE_ROOT } from './livraison';

/**
 * L'accès bridé de bout en bout (ADR 0032), dans une machine jetable : un
 * conteneur systemd privilégié avec un vrai sshd et un vrai sudo, où tourne le
 * **vrai** install.sh. Seuls deploy.sh et deploy-staging.sh sont remplacés,
 * après l'installation, par des doubles qui notent qui les lance et avec quoi :
 * leur séquence est prouvée par deploy.integration-spec.ts et
 * deploy-staging.integration-spec.ts.
 *
 * Le client SSH tourne dans la même machine, comme le ferait le runner GitHub :
 * clé dédiée, empreinte de l'hôte épinglée, aucune question posée.
 */
const CONTENEUR = `personal-os-deploy-trigger-it-${process.pid}`;

const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const ECHEC = 'dead00000000000000000000000000000000beef';
const LENT_A = '5105aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const LENT_B = '5105bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const COUPE = '5105cccccccccccccccccccccccccccccccccccc';

/** Le double d'un script de déploiement : il note, attend s'il est lent, échoue s'il le doit. */
const DOUBLE = `#!/usr/bin/env bash
sha="\${!#}"
echo "$(id -u) $(basename "$0") $*" >>/tmp/appels.log
echo "début $sha" >>/tmp/sequence.log
case "$sha" in 5105*) sleep 4 ;; esac
echo "sortie du double de $(basename "$0") pour $sha"
echo "fin $sha" >>/tmp/sequence.log
case "$sha" in dead*) echo "migration refusée" >&2; exit 3 ;; esac
`;

/** L'ancien minuteur, tel qu'une machine installée avant l'ADR 0032 l'a encore. */
const ANCIENNES_UNITES: Record<string, string> = {
  'personal-os-deploy.service': '[Service]\nType=oneshot\nExecStart=/bin/true\n',
  'personal-os-deploy.timer':
    '[Timer]\nOnBootSec=1h\nOnUnitActiveSec=1h\n[Install]\nWantedBy=timers.target\n',
  'personal-os-deploy-failure@.service': '[Service]\nType=oneshot\nExecStart=/bin/true\n',
};

interface Resultat {
  status: number;
  stdout: string;
  stderr: string;
}

/** Un script bash dans la machine, en root. */
function dans(script: string): Resultat {
  const resultat = spawnSync('docker', ['exec', '-i', CONTENEUR, 'bash', '-s'], {
    input: script,
    encoding: 'utf8',
  });
  return {
    status: resultat.status ?? 1,
    stdout: resultat.stdout ?? '',
    stderr: resultat.stderr ?? '',
  };
}

function reussi(script: string): string {
  const resultat = dans(`set -euo pipefail\n${script}`);
  if (resultat.status !== 0) {
    throw new Error(`échec (${resultat.status}) :\n${script}\n${resultat.stdout}\n${resultat.stderr}`);
  }
  return resultat.stdout;
}

/** Ce qu'envoie le runner : `ssh deploy@hôte <commande>`, avec la clé de l'environnement. */
function pousser(cle: string, commande?: string): Resultat {
  return dans(`pousser ${cle} ${commande === undefined ? '' : `'${commande}'`} </dev/null`);
}

function installer(): string {
  const sortie = reussi(`
    SOURCE_REMOTE=/srv/depot.git /source/bin/install.sh 2>&1
    for script in deploy.sh deploy-staging.sh; do
      install -m 755 /root/double /opt/personal-os/deploy/bin/$script
    done
  `);
  return sortie;
}

function appels(): string[] {
  return reussi('cat /tmp/appels.log 2>/dev/null || true').split('\n').filter(Boolean);
}

describe('deploy-trigger derrière sshd, posé par install.sh', () => {
  let sortieInstall: string;

  beforeAll(() => {
    requireTool('docker');

    sh('docker', [
      'run', '-d', '--name', CONTENEUR, '--privileged', '--cgroupns=host',
      '-v', '/sys/fs/cgroup:/sys/fs/cgroup:rw', '--tmpfs', '/run', '--tmpfs', '/run/lock',
      '-v', `${SOURCE_ROOT}:/source:ro`,
      'debian:12',
      'bash', '-c',
      `apt-get update -qq &&
        DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends \
          systemd systemd-sysv dbus openssh-server openssh-client sudo git curl ca-certificates >/dev/null &&
        rm -f /usr/sbin/policy-rc.d &&
        exec /sbin/init`,
    ]);

    let etat = '';
    for (let essai = 0; essai < 150; essai += 1) {
      etat = dans('systemctl is-system-running 2>/dev/null').stdout.trim();
      if (etat === 'running' || etat === 'degraded') break;
      sh('sleep', ['2']);
    }
    if (etat !== 'running' && etat !== 'degraded') {
      throw new Error(`systemd n'a pas démarré dans le conteneur (${etat})`);
    }

    // La machine telle que l'ancien déploiement l'a laissée : minuteur armé, un
    // groupe docker (que deploy ne doit pas recevoir), docker lui-même
    // remplacé par un double, un dépôt à cloner, un sendmail qui garde le
    // courriel.
    const unites = Object.entries(ANCIENNES_UNITES)
      .map(([nom, contenu]) => `printf '%s' '${contenu}' >/etc/systemd/system/${nom}`)
      .join('\n');
    reussi(`
      ${unites}
      systemctl daemon-reload
      systemctl enable --now personal-os-deploy.timer
      systemctl is-active --quiet personal-os-deploy.timer
      groupadd -f docker
      printf '#!/bin/sh\\nexit 0\\n' >/usr/local/bin/docker && chmod +x /usr/local/bin/docker
      printf '#!/bin/sh\\ncat >/tmp/courriel.txt\\n' >/usr/sbin/sendmail && chmod +x /usr/sbin/sendmail
      git init -q --bare /srv/depot.git
      cat >/root/double <<'DOUBLE'
${DOUBLE}DOUBLE
    `);

    // Les clés de l'opérateur, posées avant l'installation comme le dit le README.
    reussi(`
      mkdir -p /root/cles /etc/personal-os/deploy-keys
      for env in prod staging inconnue; do
        ssh-keygen -q -t ed25519 -N '' -C "$env@poste" -f /root/cles/$env
      done
      cp /root/cles/prod.pub /root/cles/staging.pub /etc/personal-os/deploy-keys/
      echo "127.0.0.1 $(cut -d' ' -f1,2 /etc/ssh/ssh_host_ed25519_key.pub)" >/root/known_hosts
      cat >/usr/local/bin/pousser <<'POUSSER'
#!/bin/sh
cle=$1; shift
exec ssh -i /root/cles/$cle -o IdentitiesOnly=yes -o BatchMode=yes \\
  -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/root/known_hosts \\
  -T deploy@127.0.0.1 "$@"
POUSSER
      chmod +x /usr/local/bin/pousser
    `);

    sortieInstall = installer();
    reussi("echo 'DEPLOY_ALERT_EMAIL=moi@exemple.test' >>/etc/personal-os/deploy.conf");
  });

  afterAll(() => {
    silence(() => sh('docker', ['rm', '-f', '-v', CONTENEUR]));
  });

  beforeEach(() => {
    reussi('rm -f /tmp/appels.log /tmp/sequence.log /tmp/courriel.txt');
  });

  describe('install.sh', () => {
    it("retire le minuteur et son service : plus rien ne déploie de lui-même", () => {
      expect(sortieInstall).toContain('minuteur de déploiement retiré');
      expect(reussi('ls /etc/systemd/system | grep personal-os-deploy || true')).toBe('');
      expect(reussi('systemctl list-timers --all --no-legend')).not.toContain('personal-os-deploy');
      expect(reussi('systemctl list-unit-files --no-legend "personal-os-deploy*" || true')).toBe('');
    });

    it("crée deploy sans mot de passe, hors du groupe docker, propriétaire de rien", () => {
      expect(reussi('getent passwd deploy | cut -d: -f7').trim()).toBe('/bin/sh');
      expect(reussi('getent shadow deploy | cut -d: -f2').trim()).toBe('*');
      expect(reussi('id -nG deploy').trim().split(' ')).not.toContain('docker');
      expect(reussi('stat -c "%U %a" /home/deploy/.ssh /home/deploy/.ssh/authorized_keys')).toBe(
        'root 755\nroot 644\n'
      );
    });

    it("n'ouvre à deploy, en root, que deploy-trigger pour ses deux environnements", () => {
      const droits = reussi('sudo -l -U deploy');
      const commandes = droits
        .slice(droits.indexOf('may run the following commands'))
        .split('\n')
        .slice(1)
        .filter((ligne) => ligne.trim() !== '');
      expect(commandes).toEqual([
        expect.stringMatching(
          /\(root\) NOPASSWD: \/opt\/personal-os\/deploy\/bin\/deploy-trigger prod, \/opt\/personal-os\/deploy\/bin\/deploy-trigger staging$/
        ),
      ]);
    });

    it('se relance sans rien casser', () => {
      installer();
      expect(pousser('staging', `deploy staging ${SHA}`).status).toBe(0);
    });
  });

  describe('ce que la clé refuse', () => {
    it('refuse une commande quelconque, sans rien lancer', () => {
      const resultat = pousser('staging', 'ls');

      expect(resultat.status).toBe(2);
      expect(resultat.stderr).toContain('refusé');
      expect(appels()).toEqual([]);
    });

    it('refuse une session sans commande', () => {
      expect(pousser('staging').status).toBe(2);
      expect(appels()).toEqual([]);
    });

    it("refuse l'environnement de l'autre clé", () => {
      expect(pousser('staging', `deploy prod ${SHA}`).status).toBe(2);
      expect(pousser('prod', `deploy staging ${SHA}`).status).toBe(2);
      expect(appels()).toEqual([]);
    });

    it('refuse un commit invalide', () => {
      expect(pousser('staging', 'deploy staging develop').status).toBe(2);
      expect(pousser('staging', `deploy staging ${SHA.slice(0, 7)}`).status).toBe(2);
      expect(appels()).toEqual([]);
    });

    it("refuse une clé qu'install.sh n'a pas posée", () => {
      expect(pousser('inconnue', `deploy staging ${SHA}`).status).toBe(255);
      expect(appels()).toEqual([]);
    });

    it('refuse de servir de relais vers un autre port', () => {
      const resultat = dans(
        'ssh -i /root/cles/staging -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes ' +
          '-o UserKnownHostsFile=/root/known_hosts -W 127.0.0.1:22 deploy@127.0.0.1 </dev/null'
      );

      expect(resultat.status).not.toBe(0);
      expect(resultat.stdout).not.toContain('OpenSSH');
    });
  });

  describe('ce que la clé accepte', () => {
    it('déploie le staging en root, sortie recopiée vers le runner', () => {
      const resultat = pousser('staging', `deploy staging ${SHA}`);

      expect(resultat.status).toBe(0);
      expect(appels()).toEqual([`0 deploy-staging.sh ${SHA}`]);
      expect(resultat.stdout).toContain(`sortie du double de deploy-staging.sh pour ${SHA}`);
    });

    it('déploie la prod par deploy.sh, forcé sur le commit demandé', () => {
      const resultat = pousser('prod', `deploy prod ${SHA}`);

      expect(resultat.status).toBe(0);
      expect(appels()).toEqual([`0 deploy.sh --force ${SHA}`]);
    });

    it('rend le code du déploiement en échec, et envoie le courriel', () => {
      const resultat = pousser('staging', `deploy staging ${ECHEC}`);

      expect(resultat.status).toBe(3);
      expect(resultat.stdout).toContain('migration refusée');
      const courriel = reussi('cat /tmp/courriel.txt');
      expect(courriel).toContain('To: moi@exemple.test');
      expect(courriel).toContain('échec : déploiement staging');
      expect(courriel).toContain('migration refusée');
    });

    it("ne déploie qu'une fois à la fois par environnement", () => {
      const resultat = reussi(`
        pousser staging 'deploy staging ${LENT_A}' </dev/null >/tmp/a.out 2>&1 &
        sleep 1
        pousser staging 'deploy staging ${LENT_B}' </dev/null >/tmp/b.out 2>&1 &
        wait
        cat /tmp/b.out
      `);

      expect(resultat).toContain('déjà en cours');
      expect(reussi('cat /tmp/sequence.log').split('\n').filter(Boolean)).toEqual([
        `début ${LENT_A}`,
        `fin ${LENT_A}`,
        `début ${LENT_B}`,
        `fin ${LENT_B}`,
      ]);
    });

    it('va au bout même si la connexion est coupée en route', () => {
      reussi(`
        pousser staging 'deploy staging ${COUPE}' </dev/null >/dev/null 2>&1 &
        sleep 1
        kill $!
        sleep 6
      `);

      expect(reussi('cat /tmp/sequence.log').split('\n').filter(Boolean)).toEqual([
        `début ${COUPE}`,
        `fin ${COUPE}`,
      ]);
      expect(reussi('cat /var/log/personal-os/deploy-trigger-staging.log')).toContain(
        `sortie du double de deploy-staging.sh pour ${COUPE}`
      );
    });
  });

  describe('rotation', () => {
    it("remplacer le .pub et relancer install.sh retire l'ancienne clé", () => {
      reussi(`
        mv /root/cles/staging /root/cles/ancienne
        mv /root/cles/staging.pub /root/cles/ancienne.pub
        ssh-keygen -q -t ed25519 -N '' -C staging@poste -f /root/cles/staging
        cp /root/cles/staging.pub /etc/personal-os/deploy-keys/staging.pub
      `);
      installer();

      expect(pousser('ancienne', `deploy staging ${SHA}`).status).toBe(255);
      expect(pousser('staging', `deploy staging ${SHA}`).status).toBe(0);
      expect(pousser('prod', `deploy prod ${SHA}`).status).toBe(0);
    });
  });
});
