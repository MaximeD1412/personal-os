import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ID_FOYER } from '../lib/espace/foyer';
import { PrismaService } from '../lib/prisma.service';

const RACINE = resolve(__dirname, '../../../..');
const SCRIPT = join(RACINE, 'scripts/captures.sh');

/** Voir le fichier : il note ses appels et présente le cookie à l'origine. */
const FAUX_NAVIGATEUR = resolve(__dirname, '../../test/faux-agent-browser.sh');
/** Enveloppe le vrai node, pour faire échouer `session.ts ouvrir` après coup. */
const FAUX_NODE = resolve(__dirname, '../../test/faux-node.sh');

interface Resultat {
  code: number | null;
  stderr: string;
}

describe('scripts/captures.sh', () => {
  let prisma: PrismaService;
  let serveur: Server;
  let origine: string;
  let dossier: string;
  /** Les cookies que `/api/auth/me` a reconnus, comme la garde de l'API. */
  let reconnus: string[];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    await prisma.user.upsert({
      where: { email: 'a@demo.test' },
      create: {
        subject: 'demo:a@demo.test',
        email: 'a@demo.test',
        householdId: ID_FOYER,
      },
      update: {},
    });

    serveur = createServer((requete, reponse) => {
      if (requete.url !== '/api/auth/me') {
        reponse.end('<html></html>');
        return;
      }
      const token = /pos_session=([^;]*)/.exec(
        requete.headers.cookie ?? '',
      )?.[1];
      void prisma.session
        .findFirst({
          where: {
            tokenHash: createHash('sha256')
              .update(token ?? '')
              .digest('hex'),
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
        })
        .then((session) => {
          if (session && token) {
            reconnus.push(token);
          }
          reponse.statusCode = session ? 200 : 401;
          reponse.end();
        });
    });
    await new Promise<void>((ok) => serveur.listen(0, '127.0.0.1', ok));
    origine = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
  });

  beforeEach(() => {
    reconnus = [];
    dossier = mkdtempSync(join(tmpdir(), 'captures-'));
    symlinkSync(FAUX_NAVIGATEUR, join(dossier, 'agent-browser'));
    symlinkSync(FAUX_NODE, join(dossier, 'node'));
    // Le .env du poste n'entre pas dans les tests : chacun écrit le sien.
    writeFileSync(join(dossier, '.env'), '');
  });

  afterEach(async () => {
    rmSync(dossier, { recursive: true, force: true });
    await prisma.session.deleteMany({});
  });

  afterAll(async () => {
    await new Promise((ok) => serveur.close(ok));
    await prisma?.$disconnect();
  });

  function capturer(
    chemins: string[],
    env: Record<string, string | undefined> = {},
    pendant?: (enfant: ReturnType<typeof spawn>) => void,
  ): Promise<Resultat> {
    const variables: Record<string, string | undefined> = {
      ...process.env,
      PATH: `${dossier}:${process.env['PATH']}`,
      VRAI_NODE: process.execPath,
      FAUX_ETAT: dossier,
      DOTENV_CONFIG_PATH: join(dossier, '.env'),
      DEMO_ACCOUNT_EMAILS: 'a@demo.test,b@demo.test',
      APP_ENV: 'development',
      CAPTURES_URL: origine,
      CAPTURES_DIR: join(dossier, 'captures'),
      ...env,
    };
    // Une variable à `undefined` est absente de l'environnement du script.
    for (const [nom, valeur] of Object.entries(variables)) {
      if (valeur === undefined) {
        delete variables[nom];
      }
    }
    return new Promise((ok) => {
      const enfant = spawn(SCRIPT, chemins, { cwd: RACINE, env: variables });
      let stderr = '';
      enfant.stderr.on('data', (bloc) => (stderr += String(bloc)));
      enfant.on('error', (erreur) => ok({ code: -1, stderr: String(erreur) }));
      enfant.on('close', (code) => ok({ code, stderr }));
      pendant?.(enfant);
    });
  }

  function appels(): string[] {
    return readFileSync(join(dossier, 'appels'), 'utf8').trim().split('\n');
  }

  it('produit une capture mobile et une desktop par chemin, authentifiées', async () => {
    const { code, stderr } = await capturer(['/agenda', '/calendrier']);

    expect(stderr).not.toMatch(/ÉCHEC/);
    expect(code).toBe(0);
    expect(readdirSync(join(dossier, 'captures')).sort()).toEqual([
      'agenda-desktop.png',
      'agenda-mobile.png',
      'calendrier-desktop.png',
      'calendrier-mobile.png',
    ]);
    expect(reconnus.length).toBeGreaterThanOrEqual(4);
    expect(readFileSync(join(dossier, 'cookie'), 'utf8').trim()).toBe(
      reconnus[0],
    );
  });

  it('capture en 390×844 puis en 1280×800, la page ouverte par son URL', async () => {
    await capturer(['/agenda']);

    const suite = appels().filter((appel) =>
      /^(set viewport|open|screenshot)/.test(appel),
    );
    expect(suite).toEqual([
      'set viewport 390 844',
      `open ${origine}/agenda`,
      `screenshot ${join(dossier, 'captures', 'agenda-mobile.png')}`,
      'set viewport 1280 800',
      `open ${origine}/agenda`,
      `screenshot ${join(dossier, 'captures', 'agenda-desktop.png')}`,
    ]);
  });

  it.each([
    ['/', 'accueil'],
    [
      '/calendrier/evenements/nouveau?titre=Repas',
      'calendrier-evenements-nouveau-titre-repas',
    ],
  ])('nomme la capture de %s « %s »', async (chemin, slug) => {
    const { code } = await capturer([chemin]);

    expect(code).toBe(0);
    expect(readdirSync(join(dossier, 'captures')).sort()).toEqual([
      `${slug}-desktop.png`,
      `${slug}-mobile.png`,
    ]);
  });

  it('ne laisse aucune Session derrière elle', async () => {
    await capturer(['/agenda']);

    expect(reconnus).not.toEqual([]);
    expect(await prisma.session.count()).toBe(0);
  });

  it('ne laisse aucune Session derrière elle quand une capture échoue', async () => {
    const { code } = await capturer(['/agenda'], { FAUX_ECHEC: 'screenshot' });

    expect(code).not.toBe(0);
    expect(reconnus).not.toEqual([]);
    expect(await prisma.session.count()).toBe(0);
  });

  it('ne laisse aucune Session derrière elle quand on l’interrompt', async () => {
    const { code } = await capturer(
      ['/agenda'],
      { FAUX_PAUSE: '3' },
      (enfant) => {
        const attendre = setInterval(() => {
          void prisma.session.count().then((n) => {
            if (n > 0) {
              clearInterval(attendre);
              enfant.kill('SIGTERM');
            }
          });
        }, 100);
      },
    );

    expect(code).not.toBe(0);
    expect(await prisma.session.count()).toBe(0);
  });

  it("ne laisse aucune Session derrière elle quand l'ouverture échoue après l'avoir écrite", async () => {
    const { code } = await capturer(['/agenda'], {
      FAUX_NODE_ECHEC_OUVERTURE: '1',
    });

    expect(code).not.toBe(0);
    expect(existsSync(join(dossier, 'session-creee'))).toBe(true);
    expect(await prisma.session.count()).toBe(0);
  });

  describe('lit ses réglages dans .env', () => {
    it("l'origine et le dossier de sortie", async () => {
      writeFileSync(
        join(dossier, '.env'),
        `CAPTURES_URL=${origine}\nCAPTURES_DIR=${join(dossier, 'depuis-env')}\n`,
      );

      const { code } = await capturer(['/agenda'], {
        CAPTURES_URL: undefined,
        CAPTURES_DIR: undefined,
      });

      expect(code).toBe(0);
      expect(readdirSync(join(dossier, 'depuis-env')).sort()).toEqual([
        'agenda-desktop.png',
        'agenda-mobile.png',
      ]);
    });

    it('le port du tableau de bord, faute de CAPTURES_URL', async () => {
      const port = new URL(origine).port;
      writeFileSync(join(dossier, '.env'), `DASHBOARD_PORT=${port}\n`);

      const { code } = await capturer(['/agenda'], {
        CAPTURES_URL: undefined,
      });

      expect(code).toBe(0);
      expect(appels()).toContain(`open http://localhost:${port}/agenda`);
    });

    it("sans écraser l'environnement", async () => {
      writeFileSync(
        join(dossier, '.env'),
        `CAPTURES_DIR=${join(dossier, 'depuis-env')}\n`,
      );

      const { code } = await capturer(['/agenda']);

      expect(code).toBe(0);
      expect(existsSync(join(dossier, 'depuis-env'))).toBe(false);
      expect(readdirSync(join(dossier, 'captures'))).toHaveLength(2);
    });

    it('APP_ENV=production, refusé sans Session ni navigateur', async () => {
      writeFileSync(join(dossier, '.env'), 'APP_ENV=production\n');

      const { code, stderr } = await capturer(['/agenda'], {
        APP_ENV: undefined,
      });

      expect(code).not.toBe(0);
      expect(stderr).toMatch(/APP_ENV vaut « production »/);
      expect(stderr).not.toMatch(/ATTENTION/);
      expect(await prisma.session.count()).toBe(0);
      expect(() => appels()).toThrow();
    });
  });

  it('échoue si le tableau de bord ne reconnaît pas la Session', async () => {
    const { code, stderr } = await capturer(['/agenda'], {
      CAPTURES_URL: 'http://127.0.0.1:1',
    });

    expect(code).not.toBe(0);
    expect(stderr).toMatch(/ÉCHEC/);
    expect(await prisma.session.count()).toBe(0);
  });

  it('refuse APP_ENV=production, sans Session ni navigateur', async () => {
    const { code, stderr } = await capturer(['/agenda'], {
      APP_ENV: 'production',
    });

    expect(code).not.toBe(0);
    expect(stderr).toMatch(/APP_ENV vaut « production »/);
    expect(stderr).not.toMatch(/ATTENTION/);
    expect(await prisma.session.count()).toBe(0);
    expect(() => appels()).toThrow();
  });

  it('demande au moins un chemin', async () => {
    const { code, stderr } = await capturer([]);

    expect(code).toBe(2);
    expect(stderr).toMatch(/Usage/);
  });
});
