import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  zHousehold,
  zHouseholdMember,
  type Household,
} from '@personal-os/contracts';
import request from 'supertest';
import {
  demarrerFauxAuthentik,
  type FauxAuthentik,
} from '../../../test/faux-authentik';
import {
  poserLeJeuDEspaces,
  type JeuDEspaces,
} from '../../../test/jeu-d-espaces';
import { codeDErreur } from '../../../test/code-d-erreur';
import { conformeA } from '../../../test/conforme';
import { AppModule } from '../app.module';

const REDIRECT_URI = 'http://app.exemple.test/api/auth/callback';
const DASHBOARD_URL = 'http://app.exemple.test/';
const ADRESSE_A = 'a@exemple.test';
const ADRESSE_B = 'b@exemple.test';

/** Un Foyer exactement conforme au contrat, sans un champ de plus. */
const UN_FOYER = zHousehold
  .extend({ members: zHouseholdMember.strict().array() })
  .strict();

/**
 * La route n'a ni entrée ni identifiant : ni 400 ni 404 à prouver, et `User`
 * comme `Household` sont hors Espace (ADR 0030).
 */
describe('Foyer', () => {
  let authentik: FauxAuthentik;
  let app: INestApplication;
  let jeu: JeuDEspaces;

  beforeAll(async () => {
    authentik = await demarrerFauxAuthentik();

    process.env['OIDC_ISSUER'] = authentik.issuer;
    process.env['OIDC_CLIENT_ID'] = 'personal-os';
    process.env['OIDC_CLIENT_SECRET'] = 'secret-de-test';
    process.env['OIDC_REDIRECT_URI'] = REDIRECT_URI;
    process.env['DASHBOARD_URL'] = DASHBOARD_URL;
    process.env['AUTH_ALLOWED_EMAILS'] = `${ADRESSE_A},${ADRESSE_B}`;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    jeu = await poserLeJeuDEspaces(app, authentik, [ADRESSE_A, ADRESSE_B]);
  });

  afterAll(async () => {
    await app?.close();
    await authentik?.close();
  });

  describe('GET /household', () => {
    it('rend le Foyer et ses deux Comptes, conformes au contrat', async () => {
      const reponse = await request(app.getHttpServer())
        .get('/api/household')
        .set('Cookie', jeu.a.session)
        .expect(200)
        .expect(conformeA(UN_FOYER));

      const foyer = reponse.body as Household;
      expect(foyer.name).not.toBe('');
      expect(foyer.members).toHaveLength(2);
    });

    it("nomme un Compte sans nom d'affichage par la partie locale de son e-mail", async () => {
      const reponse = await request(app.getHttpServer())
        .get('/api/household')
        .set('Cookie', jeu.a.session)
        .expect(200);

      expect(
        (reponse.body as Household).members.map(
          ({ displayName }) => displayName,
        ),
      ).toEqual(['a', 'b']);
    });

    it("n'expose ni e-mail ni sujet OIDC", async () => {
      const reponse = await request(app.getHttpServer())
        .get('/api/household')
        .set('Cookie', jeu.a.session)
        .expect(200);

      const corps = JSON.stringify(reponse.body);
      expect(corps).not.toContain('@');
      expect(corps).not.toContain('sujet-');
    });

    it('rend le même Foyer aux deux Comptes', async () => {
      const [vuDeA, vuDeB] = await Promise.all(
        [jeu.a, jeu.b].map((compte) =>
          request(app.getHttpServer())
            .get('/api/household')
            .set('Cookie', compte.session)
            .expect(200),
        ),
      );

      expect(vuDeB.body).toEqual(vuDeA.body);
    });

    it('refuse en 401 une lecture sans session', async () => {
      await request(app.getHttpServer())
        .get('/api/household')
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });
});
