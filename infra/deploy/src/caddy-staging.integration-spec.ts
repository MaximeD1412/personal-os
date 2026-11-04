import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { portsPris, requireTool, sh, silence, SOURCE_ROOT } from './livraison';

/**
 * Le vrai Caddyfile de la prod et ses conf.d/, dans l'image de la prod, devant
 * des doubles : un « Authentik » dont l'outpost n'accepte qu'un cookie connu,
 * et des amonts qui répondent leur hôte et leur chemin.
 *
 * Ce qui compte : rien du staging, ni ses pages ni les données publiques de
 * son portfolio, ne sort sans session Authentik (ADR 0031, SEC-4) ; le
 * portfolio de la prod, lui, reste public.
 */
const RESEAU = 'personal-os-caddy-staging-it';
const DOUBLE = 'personal-os-caddy-staging-it-amonts';
const CADDY = 'personal-os-caddy-staging-it-caddy';
const PORT = 18190;

const HOTES = {
  PORTFOLIO_HOST: 'portfolio.exemple.test',
  DASHBOARD_HOST: 'app.exemple.test',
  AUTHENTIK_HOST: 'auth.exemple.test',
  STAGING_DASHBOARD_HOST: 'staging.exemple.test',
  STAGING_PORTFOLIO_HOST: 'staging-portfolio.exemple.test',
};

const COOKIE_DE_SESSION = 'authentik_proxy_test=session-valide';

/** L'outpost sur 9000, les amonts sur 80, tous sous leurs noms de service. */
const DOUBLES = `
const http = require('http');
http.createServer((q, r) => {
  if (q.url.startsWith('/outpost.goauthentik.io/auth/caddy')) {
    if ((q.headers.cookie || '').includes('${COOKIE_DE_SESSION}')) { r.writeHead(200); return r.end(); }
    r.writeHead(302, { Location: 'https://${HOTES.AUTHENTIK_HOST}/connexion' });
    return r.end('connexion exigée');
  }
  if (q.url.startsWith('/outpost.goauthentik.io/')) { r.writeHead(200); return r.end('outpost ' + q.url); }
  r.writeHead(200); r.end('authentik ' + q.url);
}).listen(9000);
http.createServer((q, r) => { r.writeHead(200); r.end('amont ' + q.headers.host + q.url); }).listen(80);
`;

describe('Caddy interne : les hôtes du staging', () => {
  let racine: string;

  function requete(hote: string, chemin: string, cookie?: string): { code: number; corps: string } {
    const sortie = sh('curl', [
      '--silent', '--show-error', '--max-time', '5',
      '--header', `Host: ${hote}`,
      ...(cookie ? ['--cookie', cookie] : []),
      '--write-out', '\n%{http_code}',
      `http://127.0.0.1:${PORT}${chemin}`,
    ]);
    const coupure = sortie.lastIndexOf('\n');
    return { code: Number(sortie.slice(coupure + 1)), corps: sortie.slice(0, coupure) };
  }

  function nettoyer(): void {
    silence(() => sh('docker', ['rm', '--force', CADDY, DOUBLE]));
    silence(() => sh('docker', ['network', 'rm', RESEAU]));
  }

  beforeAll(async () => {
    for (const outil of ['docker', 'curl']) requireTool(outil);
    nettoyer();
    const pris = await portsPris([{ port: PORT, role: 'le Caddy interne' }]);
    if (pris.length > 0) {
      throw new Error(`Le port ${PORT} est déjà pris : une autre campagne tourne probablement.`);
    }

    racine = mkdtempSync(join(tmpdir(), 'personal-os-caddy-staging-'));
    writeFileSync(join(racine, 'doubles.js'), DOUBLES);

    sh('docker', ['network', 'create', RESEAU]);
    sh('docker', [
      'run', '--detach', '--name', DOUBLE, '--network', RESEAU,
      ...['authentik', 'staging-dashboard', 'staging-portfolio', 'dashboard', 'portfolio']
        .flatMap((alias) => ['--network-alias', alias]),
      '--volume', `${join(racine, 'doubles.js')}:/doubles.js:ro`,
      'node:24-alpine', 'node', '/doubles.js',
    ]);
    sh('docker', [
      'run', '--detach', '--name', CADDY, '--network', RESEAU,
      '--publish', `127.0.0.1:${PORT}:80`,
      ...Object.entries(HOTES).flatMap(([cle, valeur]) => ['--env', `${cle}=${valeur}`]),
      '--volume', `${join(SOURCE_ROOT, 'caddy', 'Caddyfile')}:/etc/caddy/Caddyfile:ro`,
      '--volume', `${join(SOURCE_ROOT, 'caddy', 'conf.d')}:/etc/caddy/conf.d:ro`,
      'caddy:2-alpine',
    ]);

    // Caddy et les doubles prêts : le portfolio de la prod répond.
    for (let essai = 0; ; essai++) {
      try {
        if (requete(HOTES.PORTFOLIO_HOST, '/').code === 200) break;
      } catch {
        // pas encore à l'écoute
      }
      if (essai >= 40) {
        throw new Error(`Caddy ne répond pas :\n${sh('docker', ['logs', CADDY])}`);
      }
      sh('sleep', ['0.5']);
    }
  });

  afterAll(() => {
    nettoyer();
    if (racine) rmSync(racine, { recursive: true, force: true });
  });

  it.each([
    ['le portfolio du staging', HOTES.STAGING_PORTFOLIO_HOST, '/'],
    ['les données publiques du portfolio du staging', HOTES.STAGING_PORTFOLIO_HOST, '/api/public/projects'],
    ['le tableau de bord du staging', HOTES.STAGING_DASHBOARD_HOST, '/'],
    ['les données publiques, par le tableau de bord du staging', HOTES.STAGING_DASHBOARD_HOST, '/api/public/projects'],
  ])('renvoie vers Authentik, sans session, pour %s', (_cas, hote, chemin) => {
    const reponse = requete(hote, chemin);

    expect(reponse.code).toBe(302);
    expect(reponse.corps).not.toContain('amont');
  });

  it.each([
    [HOTES.STAGING_PORTFOLIO_HOST, 'staging-portfolio'],
    [HOTES.STAGING_DASHBOARD_HOST, 'staging-dashboard'],
  ])('sert %s avec une session Authentik', (hote) => {
    const reponse = requete(hote, '/api/public/projects', COOKIE_DE_SESSION);

    expect(reponse).toEqual({ code: 200, corps: `amont ${hote}/api/public/projects` });
  });

  it("laisse passer, sans session, les chemins de l'outpost : c'est par eux qu'on se connecte", () => {
    const reponse = requete(HOTES.STAGING_PORTFOLIO_HOST, '/outpost.goauthentik.io/start?rd=%2F');

    expect(reponse.code).toBe(200);
    expect(reponse.corps).toContain('outpost /outpost.goauthentik.io/start');
  });

  it('laisse le portfolio de la prod public', () => {
    expect(requete(HOTES.PORTFOLIO_HOST, '/api/public/projects')).toEqual({
      code: 200,
      corps: `amont ${HOTES.PORTFOLIO_HOST}/api/public/projects`,
    });
  });
});
