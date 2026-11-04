import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { portsPris, requireTool, sh, silence } from './livraison';

/**
 * Le vrai `nginx.conf` du tableau de bord, dans l'image de la prod, devant un
 * double de l'API qui répond son chemin.
 *
 * Ce qui compte : les routes internes de l'API (l'agent de sauvegarde y
 * transmet son état, DASH-3) ne sont pas joignables depuis Internet, quelle
 * que soit la façon d'écrire le chemin ; le reste de l'API passe.
 */
const RESEAU = 'personal-os-nginx-dashboard-it';
const DOUBLE = 'personal-os-nginx-dashboard-it-api';
const NGINX = 'personal-os-nginx-dashboard-it-nginx';
const PORT = 18191;

const CONF = join(__dirname, '..', '..', '..', 'packages', 'dashboard', 'nginx.conf');

const DOUBLE_API = `
require('http').createServer((q, r) => { r.writeHead(200); r.end('api ' + q.url); }).listen(3000);
`;

describe('nginx du tableau de bord : les routes internes de l’API', () => {
  let racine: string;

  function requete(chemin: string, methode = 'GET'): { code: number; corps: string } {
    const sortie = sh('curl', [
      '--silent', '--show-error', '--max-time', '5', '--path-as-is',
      '--request', methode,
      '--write-out', '\n%{http_code}',
      `http://127.0.0.1:${PORT}${chemin}`,
    ]);
    const coupure = sortie.lastIndexOf('\n');
    return { code: Number(sortie.slice(coupure + 1)), corps: sortie.slice(0, coupure) };
  }

  function nettoyer(): void {
    silence(() => sh('docker', ['rm', '--force', NGINX, DOUBLE]));
    silence(() => sh('docker', ['network', 'rm', RESEAU]));
  }

  beforeAll(async () => {
    for (const outil of ['docker', 'curl']) requireTool(outil);
    nettoyer();
    const pris = await portsPris([{ port: PORT, role: 'le nginx du tableau de bord' }]);
    if (pris.length > 0) {
      throw new Error(`Le port ${PORT} est déjà pris : une autre campagne tourne probablement.`);
    }

    racine = mkdtempSync(join(tmpdir(), 'personal-os-nginx-dashboard-'));
    writeFileSync(join(racine, 'api.js'), DOUBLE_API);

    sh('docker', ['network', 'create', RESEAU]);
    sh('docker', [
      'run', '--detach', '--name', DOUBLE, '--network', RESEAU, '--network-alias', 'api',
      '--volume', `${join(racine, 'api.js')}:/api.js:ro`,
      'node:24-alpine', 'node', '/api.js',
    ]);
    sh('docker', [
      'run', '--detach', '--name', NGINX, '--network', RESEAU,
      '--publish', `127.0.0.1:${PORT}:80`,
      '--volume', `${CONF}:/etc/nginx/conf.d/default.conf:ro`,
      'nginx:1.29-alpine',
    ]);

    for (let essai = 0; ; essai++) {
      try {
        if (requete('/api/health').code === 200) break;
      } catch {
        // pas encore à l'écoute
      }
      if (essai >= 40) {
        throw new Error(`nginx ne répond pas :\n${sh('docker', ['logs', NGINX])}`);
      }
      sh('sleep', ['0.5']);
    }
  });

  afterAll(() => {
    nettoyer();
    if (racine) rmSync(racine, { recursive: true, force: true });
  });

  it.each([
    '/api/internal/backup-status',
    '/api/INTERNAL/backup-status',
    '/api//internal/backup-status',
    '/api/internal',
    '/api/internal/',
    '/api/%69nternal/backup-status',
  ])('répond 404 sans relayer %s', (chemin) => {
    const reponse = requete(chemin, 'POST');

    expect(reponse.code).toBe(404);
    expect(reponse.corps).not.toContain('api ');
  });

  it.each(['/api/health', '/api/internals-de-rien', '/api/dashboard/summaries'])(
    'relaie %s à l’API',
    (chemin) => {
      expect(requete(chemin)).toEqual({ code: 200, corps: `api ${chemin}` });
    },
  );
});
