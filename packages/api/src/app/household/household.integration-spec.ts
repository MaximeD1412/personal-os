import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  zHousehold,
  zHouseholdMember,
  type Household,
} from '@personal-os/contracts';
import { ID_FOYER, PrismaService } from '@personal-os/database';
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
 * La campagne d'intégration partage sa base entre les fichiers : d'autres
 * Comptes que ceux du jeu peuvent rejoindre le Foyer. La réponse se compare
 * donc aux Comptes réellement rattachés au Foyer, et les deux du jeu doivent
 * y être.
 *
 * La route n'a ni entrée ni identifiant : ni 400 ni 404 à prouver, et `User`
 * comme `Household` sont hors Espace (ADR 0030).
 */
describe('Foyer', () => {
  let authentik: FauxAuthentik;
  let app: INestApplication;
  let jeu: JeuDEspaces;
  let prisma: PrismaService;

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
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
    await authentik?.close();
  });

  describe('GET /household', () => {
    it('rend le Foyer et ses Comptes, conformes au contrat', async () => {
      const reponse = await request(app.getHttpServer())
        .get('/api/household')
        .set('Cookie', jeu.a.session)
        .expect(200)
        .expect(conformeA(UN_FOYER));

      const rattaches = await prisma.user.findMany({
        where: { householdId: ID_FOYER },
        select: { id: true, email: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      const foyer = reponse.body as Household;

      expect(foyer.id).toBe(ID_FOYER);
      expect(foyer.name).not.toBe('');
      expect(foyer.members.map(({ id }) => id)).toEqual(
        rattaches.map(({ id }) => id),
      );
      expect(rattaches.map(({ email }) => email)).toEqual(
        expect.arrayContaining([ADRESSE_A, ADRESSE_B]),
      );
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
      ).toEqual(expect.arrayContaining(['a', 'b']));
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
