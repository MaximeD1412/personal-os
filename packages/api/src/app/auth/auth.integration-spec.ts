import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '@personal-os/database';
import request from 'supertest';
import {
  demarrerFauxAuthentik,
  type FauxAuthentik,
} from '../../../test/faux-authentik';
import { AppModule } from '../app.module';

const REDIRECT_URI = 'http://app.exemple.test/api/auth/callback';
const DASHBOARD_URL = 'http://app.exemple.test/';
const ADMIS = 'admis@exemple.test';

describe('Authentification OIDC', () => {
  let authentik: FauxAuthentik;
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    authentik = await demarrerFauxAuthentik();

    process.env['OIDC_ISSUER'] = authentik.issuer;
    process.env['OIDC_CLIENT_ID'] = 'personal-os';
    process.env['OIDC_CLIENT_SECRET'] = 'secret-de-test';
    process.env['OIDC_REDIRECT_URI'] = REDIRECT_URI;
    process.env['DASHBOARD_URL'] = DASHBOARD_URL;
    process.env['AUTH_ALLOWED_EMAILS'] = ADMIS;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
    await authentik?.close();
  });

  describe('Garde de session', () => {
    it('refuse une requête API présentée sans session', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('laisse la sonde de santé joignable sans session', async () => {
      const response = await request(app.getHttpServer()).get('/api/health');

      expect(response.status).not.toBe(401);
    });
  });

  describe('Départ du flux authorization code', () => {
    it('renvoie le navigateur vers Authentik, avec un défi PKCE et un état', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/login')
        .expect(302);

      const destination = new URL(response.headers['location']);
      expect(`${destination.origin}${destination.pathname}`).toBe(
        `${new URL(authentik.issuer).origin}/application/o/authorize/`,
      );
      expect(destination.searchParams.get('response_type')).toBe('code');
      expect(destination.searchParams.get('client_id')).toBe('personal-os');
      expect(destination.searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
      expect(destination.searchParams.get('scope')).toContain('openid');
      expect(destination.searchParams.get('code_challenge_method')).toBe(
        'S256',
      );
      expect(destination.searchParams.get('code_challenge')).toBeTruthy();
      expect(destination.searchParams.get('state')).toBeTruthy();
      expect(destination.searchParams.get('nonce')).toBeTruthy();
    });

    it("rattache l'aller-retour au navigateur par un cookie HttpOnly", async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/login')
        .expect(302);

      const cookies = response.headers['set-cookie'] as unknown as string[];
      const login = cookies.find((cookie) => cookie.startsWith('pos_login='));

      expect(login).toBeDefined();
      expect(login).toContain('HttpOnly');
      expect(login).toContain('SameSite=Lax');
    });

    it('ne laisse jamais le secret client atteindre le navigateur', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/login')
        .expect(302);

      const dehors = JSON.stringify(response.headers);
      expect(dehors).not.toContain('secret-de-test');
    });
  });

  describe("Retour d'Authentik", () => {
    it('échange le code et émet une session applicative en cookie', async () => {
      const depart = await commencer();
      authentik.autoriserCode('code-valide', {
        nonce: depart.nonce,
        codeChallenge: depart.codeChallenge,
        identite: { sub: 'sujet-1', email: ADMIS, name: 'Personne Admise' },
      });

      const retour = await request(app.getHttpServer())
        .get(`/api/auth/callback?code=code-valide&state=${depart.state}`)
        .set('Cookie', depart.cookieLogin)
        .expect(302);

      expect(retour.headers['location']).toBe(DASHBOARD_URL);

      const session = setCookie(retour, 'pos_session');
      expect(session).toContain('HttpOnly');
      expect(session).toContain('Secure');
      expect(session).toContain('SameSite=Lax');
    });

    it('laisse le tableau de bord savoir qui il sert', async () => {
      const session = await connecter({
        sub: 'sujet-1',
        email: ADMIS,
        name: 'Personne Admise',
      });

      const moi = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', session)
        .expect(200);

      expect(moi.body).toEqual({
        email: ADMIS,
        displayName: 'Personne Admise',
      });
    });

    it("ne laisse aucun jeton du fournisseur d'identité atteindre le navigateur", async () => {
      const depart = await commencer();
      authentik.autoriserCode('code-sans-fuite', {
        nonce: depart.nonce,
        codeChallenge: depart.codeChallenge,
        identite: { sub: 'sujet-1', email: ADMIS },
      });

      const retour = await request(app.getHttpServer())
        .get(`/api/auth/callback?code=code-sans-fuite&state=${depart.state}`)
        .set('Cookie', depart.cookieLogin)
        .expect(302);

      const jeton = authentik.dernierJetonEmis();
      expect(jeton).toBeTruthy();

      const dehors = JSON.stringify(retour.headers) + retour.text;
      expect(dehors).not.toContain(jeton);
      expect(dehors).not.toContain('acces-sujet-1');
      expect(dehors).not.toContain('secret-de-test');
    });

    it('échange le code contre un jeton, sans jamais le confier au navigateur', async () => {
      await connecter({ sub: 'sujet-1', email: ADMIS });

      const echange = authentik.dernierEchange();
      expect(echange?.get('grant_type')).toBe('authorization_code');
      expect(echange?.get('code_verifier')).toBeTruthy();
      expect(echange?.get('redirect_uri')).toBe(REDIRECT_URI);
    });
  });

  describe('Admission', () => {
    it('refuse une identité valide chez Authentik mais absente de la liste', async () => {
      const avant = await prisma.user.count();
      const depart = await commencer();
      authentik.autoriserCode('code-inconnu', {
        nonce: depart.nonce,
        codeChallenge: depart.codeChallenge,
        identite: { sub: 'sujet-etranger', email: 'dehors@exemple.test' },
      });

      await request(app.getHttpServer())
        .get(`/api/auth/callback?code=code-inconnu&state=${depart.state}`)
        .set('Cookie', depart.cookieLogin)
        .expect(403);

      expect(await prisma.user.count()).toBe(avant);
    });

    it("rattache le compte au sujet Authentik, pas à l'adresse", async () => {
      await connecter({ sub: 'sujet-1', email: ADMIS, name: 'Premier Nom' });
      await connecter({ sub: 'sujet-1', email: ADMIS, name: 'Second Nom' });

      const comptes = await prisma.user.findMany({
        where: { subject: 'sujet-1' },
      });

      expect(comptes).toHaveLength(1);
      expect(comptes[0].displayName).toBe('Second Nom');
    });
  });

  describe('Retours qui ne prouvent rien', () => {
    it("refuse un retour dont l'état ne correspond pas à la demande", async () => {
      const depart = await commencer();
      authentik.autoriserCode('code-etat', {
        nonce: depart.nonce,
        codeChallenge: depart.codeChallenge,
        identite: { sub: 'sujet-1', email: ADMIS },
      });

      await request(app.getHttpServer())
        .get('/api/auth/callback?code=code-etat&state=un-etat-invente')
        .set('Cookie', depart.cookieLogin)
        .expect(401);
    });

    it("refuse un retour présenté sans le cookie d'aller-retour", async () => {
      const depart = await commencer();
      authentik.autoriserCode('code-sans-cookie', {
        nonce: depart.nonce,
        codeChallenge: depart.codeChallenge,
        identite: { sub: 'sujet-1', email: ADMIS },
      });

      await request(app.getHttpServer())
        .get(`/api/auth/callback?code=code-sans-cookie&state=${depart.state}`)
        .expect(401);
    });

    it('refuse de rejouer un aller-retour déjà consommé', async () => {
      const depart = await commencer();
      authentik.autoriserCode('code-rejoue', {
        nonce: depart.nonce,
        codeChallenge: depart.codeChallenge,
        identite: { sub: 'sujet-1', email: ADMIS },
      });

      await request(app.getHttpServer())
        .get(`/api/auth/callback?code=code-rejoue&state=${depart.state}`)
        .set('Cookie', depart.cookieLogin)
        .expect(302);

      await request(app.getHttpServer())
        .get(`/api/auth/callback?code=code-rejoue&state=${depart.state}`)
        .set('Cookie', depart.cookieLogin)
        .expect(401);
    });

    it.each([
      ['mal signé', 'signature' as const],
      ['destiné à un autre client', 'audience' as const],
      ['expiré', 'expire' as const],
    ])("refuse un jeton d'identité %s", async (_libelle, jetonInvalide) => {
      const depart = await commencer();
      const code = `code-${jetonInvalide}`;
      authentik.autoriserCode(code, {
        nonce: depart.nonce,
        codeChallenge: depart.codeChallenge,
        identite: { sub: 'sujet-1', email: ADMIS },
        jetonInvalide,
      });

      await request(app.getHttpServer())
        .get(`/api/auth/callback?code=${code}&state=${depart.state}`)
        .set('Cookie', depart.cookieLogin)
        .expect(401);
    });
  });

  describe('Déconnexion', () => {
    it('invalide la session côté serveur, cookie conservé ou non', async () => {
      const session = await connecter({ sub: 'sujet-1', email: ADMIS });

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', session)
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', session)
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', session)
        .expect(401);
    });

    it('efface le cookie de session', async () => {
      const session = await connecter({ sub: 'sujet-1', email: ADMIS });

      const reponse = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', session)
        .expect(200);

      expect(setCookie(reponse, 'pos_session')).toContain(
        'Expires=Thu, 01 Jan 1970',
      );
    });

    it("renvoie vers la déconnexion d'Authentik, pour ne pas laisser sa session ouverte", async () => {
      const session = await connecter({ sub: 'sujet-1', email: ADMIS });

      const reponse = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', session)
        .expect(200);

      expect(reponse.body.endSessionUrl).toContain('/end-session/');
    });

    it('aboutit même sans session, plutôt que de refuser à qui veut partir', async () => {
      await request(app.getHttpServer()).post('/api/auth/logout').expect(200);
    });
  });

  async function connecter(identite: {
    sub: string;
    email?: string;
    name?: string;
  }): Promise<string> {
    const depart = await commencer();
    const code = `code-${Math.random().toString(36).slice(2)}`;
    authentik.autoriserCode(code, {
      nonce: depart.nonce,
      codeChallenge: depart.codeChallenge,
      identite,
    });

    const retour = await request(app.getHttpServer())
      .get(`/api/auth/callback?code=${code}&state=${depart.state}`)
      .set('Cookie', depart.cookieLogin)
      .expect(302);

    return setCookie(retour, 'pos_session').split(';')[0];
  }

  async function commencer(): Promise<{
    cookieLogin: string;
    state: string;
    nonce: string;
    codeChallenge: string;
  }> {
    const response = await request(app.getHttpServer())
      .get('/api/auth/login')
      .expect(302);

    const destination = new URL(response.headers['location']);
    return {
      cookieLogin: setCookie(response, 'pos_login').split(';')[0],
      state: destination.searchParams.get('state') ?? '',
      nonce: destination.searchParams.get('nonce') ?? '',
      codeChallenge: destination.searchParams.get('code_challenge') ?? '',
    };
  }
});

function setCookie(response: request.Response, nom: string): string {
  const cookies = (response.headers['set-cookie'] ?? []) as unknown as string[];
  const trouve = cookies.find((cookie) => cookie.startsWith(`${nom}=`));

  if (!trouve) {
    throw new Error(`aucun cookie ${nom} dans la réponse`);
  }
  return trouve;
}
