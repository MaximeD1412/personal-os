import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Scope, Trace } from '@personal-os/contracts';
import { PrismaService } from '@personal-os/database';
import request from 'supertest';
import {
  demarrerFauxAuthentik,
  type FauxAuthentik,
} from '../../../test/faux-authentik';
import {
  poserLeJeuDEspaces,
  type JeuDEspaces,
} from '../../../test/jeu-d-espaces';
import { ModuleRestreint } from '../../../test/module-restreint';
import { AppModule } from '../app.module';

const REDIRECT_URI = 'http://app.exemple.test/api/auth/callback';
const DASHBOARD_URL = 'http://app.exemple.test/';
const ADRESSE_A = 'a@exemple.test';
const ADRESSE_B = 'b@exemple.test';

/**
 * Les tests de non-exposition. Ils portent sur le **mécanisme** — la garde
 * d'Espace posée dans l'accès aux données — et non sur chaque endpoint pris
 * séparément (ADR 0016). Le fil traceur leur sert de sujet : ce qui vaut pour
 * lui vaudra pour tout modèle qui portera un Espace, puisque c'est le même
 * chemin de code.
 */
describe("Cloisonnement par Espace", () => {
  let authentik: FauxAuthentik;
  let app: INestApplication;
  let prisma: PrismaService;
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
      imports: [AppModule, ModuleRestreint],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    prisma = app.get(PrismaService);
    jeu = await poserLeJeuDEspaces(app, authentik, [ADRESSE_A, ADRESSE_B]);
  });

  afterAll(async () => {
    await app?.close();
    await authentik?.close();
  });

  describe('Le Foyer et les trois Espaces', () => {
    it('donne à chaque Compte son Espace personnel et celui du Foyer', async () => {
      const reponse = await request(app.getHttpServer())
        .get('/api/espaces')
        .set('Cookie', jeu.a.session)
        .expect(200);

      expect((reponse.body as Scope[]).map(({ kind }) => kind).sort()).toEqual([
        'HOUSEHOLD',
        'PERSONAL',
      ]);
    });

    it("ne rattache pas l'Espace personnel à un Foyer particulier", async () => {
      const personnel = await prisma.scope.findUniqueOrThrow({
        where: { id: jeu.a.espacePersonnel },
        select: { householdId: true },
      });

      expect(personnel.householdId).toBeNull();
    });

    it('ne fait exister que trois Espaces pour deux Comptes', () => {
      const tous = new Set([
        jeu.a.espacePersonnel,
        jeu.b.espacePersonnel,
        jeu.espaceFoyer,
      ]);

      expect(tous.size).toBe(3);
    });

    it("donne aux deux Comptes le même Espace foyer", async () => {
      const sien = await request(app.getHttpServer())
        .get('/api/espaces')
        .set('Cookie', jeu.b.session)
        .expect(200);

      expect(
        (sien.body as Scope[]).find(({ kind }) => kind === 'HOUSEHOLD')?.id,
      ).toBe(jeu.espaceFoyer);
    });

    it('permet à un Compte membre de plusieurs Foyers de voir leurs espaces', async () => {
      const compte = await prisma.user.findUniqueOrThrow({
        where: { email: ADRESSE_A },
        select: { id: true },
      });
      const autreFoyer = await prisma.household.create({
        data: { name: 'Autre foyer' },
      });
      await prisma.householdMember.create({
        data: {
          householdId: autreFoyer.id,
          userId: compte.id,
          role: 'MEMBER',
        },
      });
      const autreEspace = await prisma.scope.create({
        data: {
          kind: 'HOUSEHOLD',
          label: 'Autre foyer',
          householdId: autreFoyer.id,
        },
      });

      const reponse = await request(app.getHttpServer())
        .get('/api/espaces')
        .set('Cookie', jeu.a.session)
        .expect(200);

      expect((reponse.body as Scope[]).map(({ id }) => id)).toContain(
        autreEspace.id,
      );
    });
  });

  describe("Ce qu'un Compte ne voit pas", () => {
    it("ne rend jamais une Trace de l'Espace personnel de l'autre", async () => {
      const sienne = await creer(jeu.b, 'secret de B', jeu.b.espacePersonnel);

      const vues = await request(app.getHttpServer())
        .get('/api/traces')
        .set('Cookie', jeu.a.session)
        .expect(200);

      expect((vues.body as Trace[]).map(({ id }) => id)).not.toContain(
        sienne.id,
      );
    });

    it("ne la rend pas davantage à qui devine son identifiant", async () => {
      const sienne = await creer(jeu.b, 'à deviner', jeu.b.espacePersonnel);

      await request(app.getHttpServer())
        .patch(`/api/traces/${sienne.id}`)
        .set('Cookie', jeu.a.session)
        .send({ label: 'volée' })
        .expect(404);
    });

    it("ne laisse pas modifier une Trace de l'autre Espace personnel", async () => {
      const sienne = await creer(jeu.b, 'intacte', jeu.b.espacePersonnel);

      await request(app.getHttpServer())
        .patch(`/api/traces/${sienne.id}`)
        .set('Cookie', jeu.a.session)
        .send({ label: 'modifiée' })
        .expect(404);

      const relue = await request(app.getHttpServer())
        .get('/api/traces')
        .set('Cookie', jeu.b.session)
        .expect(200);

      expect(
        (relue.body as Trace[]).find(({ id }) => id === sienne.id)?.label,
      ).toBe('intacte');
    });

    it("ne laisse pas supprimer une Trace de l'autre Espace personnel", async () => {
      const sienne = await creer(jeu.b, 'survivante', jeu.b.espacePersonnel);

      await request(app.getHttpServer())
        .delete(`/api/traces/${sienne.id}`)
        .set('Cookie', jeu.a.session)
        .expect(404);

      const relue = await request(app.getHttpServer())
        .get('/api/traces')
        .set('Cookie', jeu.b.session)
        .expect(200);

      expect((relue.body as Trace[]).map(({ id }) => id)).toContain(sienne.id);
    });

    it("refuse d'écrire dans l'Espace personnel de l'autre", async () => {
      await request(app.getHttpServer())
        .post('/api/traces')
        .set('Cookie', jeu.a.session)
        .send({ label: 'intrusion', scopeId: jeu.b.espacePersonnel })
        .expect(403);
    });
  });

  describe("Ce que les deux Comptes voient pareil", () => {
    it("rend à chacun la même Trace de l'Espace foyer", async () => {
      const commune = await creer(jeu.a, 'vacances', jeu.espaceFoyer);

      for (const compte of [jeu.a, jeu.b]) {
        const vues = await request(app.getHttpServer())
          .get('/api/traces')
          .set('Cookie', compte.session)
          .expect(200);

        expect((vues.body as Trace[]).map(({ id }) => id)).toContain(
          commune.id,
        );
      }
    });

    it("laisse l'autre Compte modifier une Trace de l'Espace foyer", async () => {
      const commune = await creer(jeu.a, 'à préciser', jeu.espaceFoyer);

      await request(app.getHttpServer())
        .patch(`/api/traces/${commune.id}`)
        .set('Cookie', jeu.b.session)
        .send({ label: 'précisée' })
        .expect(200);
    });
  });

  describe("Ce qu'un module accepte", () => {
    it("refuse un Espace que le module n'accepte pas", async () => {
      await request(app.getHttpServer())
        .post('/api/foyer-seul')
        .set('Cookie', jeu.a.session)
        .send({ label: 'personnelle', scopeId: jeu.a.espacePersonnel })
        .expect(403);
    });

    it("accepte celui qu'il déclare", async () => {
      await request(app.getHttpServer())
        .post('/api/foyer-seul')
        .set('Cookie', jeu.a.session)
        .send({ label: 'commune', scopeId: jeu.espaceFoyer })
        .expect(201);
    });

    it('échoue bruyamment quand un module ne déclare aucun Espace', async () => {
      await request(app.getHttpServer())
        .post('/api/sans-declaration')
        .set('Cookie', jeu.a.session)
        .send({ label: 'muette', scopeId: jeu.espaceFoyer })
        .expect(500);
    });

    // Le refus par la garde elle-même est vérifié en test unitaire : ici, la
    // saisie n'atteint même pas l'accès aux données.
    it("refuse une saisie qui ne nomme aucun Espace", async () => {
      await request(app.getHttpServer())
        .post('/api/traces')
        .set('Cookie', jeu.a.session)
        .send({ label: 'sans espace' })
        .expect(400);
    });
  });

  describe('Sans session', () => {
    it("n'expose rien de cloisonné", async () => {
      await request(app.getHttpServer()).get('/api/traces').expect(401);
      await request(app.getHttpServer()).get('/api/espaces').expect(401);
    });
  });

  async function creer(
    compte: JeuDEspaces['a'],
    label: string,
    scopeId: string,
  ): Promise<Trace> {
    const reponse = await request(app.getHttpServer())
      .post('/api/traces')
      .set('Cookie', compte.session)
      .send({ label, scopeId })
      .expect(201);

    return reponse.body;
  }
});
