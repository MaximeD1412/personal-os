import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  zProject,
  zProjectExpense,
  zProjectSummary,
  type Project,
  type ProjectExpense,
} from '@personal-os/contracts';
import request from 'supertest';
import * as z from 'zod';
import {
  demarrerFauxAuthentik,
  type FauxAuthentik,
} from '../../../test/faux-authentik';
import {
  poserLeJeuDEspaces,
  type CompteDeTest,
  type JeuDEspaces,
} from '../../../test/jeu-d-espaces';
import { champsEnErreur, codeDErreur } from '../../../test/code-d-erreur';
import { conformeA } from '../../../test/conforme';
import { AppModule } from '../app.module';

const REDIRECT_URI = 'http://app.exemple.test/api/auth/callback';
const DASHBOARD_URL = 'http://app.exemple.test/';
const ADRESSE_A = 'a@exemple.test';
const ADRESSE_B = 'b@exemple.test';

/** Un Projet exactement conforme au contrat, sans un champ de plus. */
const UNE_DEPENSE = zProjectExpense.strict();
const UN_PROJET = zProject.strict().extend({
  expenses: z.array(UNE_DEPENSE),
});
const DES_PROJETS = z.array(zProjectSummary.strict());

const INCONNU = '00000000-0000-4000-8000-000000000000';

/**
 * Les Projets vivent dans l'Espace personnel, et lui seul : chaque Compte ne
 * voit, ne modifie et ne supprime que les siens. Le Projet de l'autre rend un
 * 404, comme un Projet qui n'existe pas (ADR 0030).
 *
 * La campagne partage sa base entre les fichiers : chaque test crée ses
 * propres Projets, et ne juge une liste que sur ceux-là.
 */
describe('Projets', () => {
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

  describe('POST /projects', () => {
    it("crée un Projet dans l'Espace personnel de son Compte, conforme au contrat", async () => {
      const reponse = await request(app.getHttpServer())
        .post('/api/projects')
        .set('Cookie', jeu.a.session)
        .send({
          title: '  Atelier de reliure ',
          notes: '# Feuille de route\n\n- [ ] Choisir le papier',
          links: [{ label: 'Fournisseur', url: 'https://papier.exemple.test' }],
        })
        .expect(201)
        .expect(conformeA(UN_PROJET));

      expect(reponse.body).toMatchObject({
        scopeId: jeu.a.espacePersonnel,
        title: 'Atelier de reliure',
        notes: '# Feuille de route\n\n- [ ] Choisir le papier',
        links: [{ label: 'Fournisseur', url: 'https://papier.exemple.test' }],
        expenses: [],
        totalSpent: { cents: 0, currency: 'EUR' },
      });
    });

    it("refuse en 400 un titre vide et un lien qui n'est pas une adresse web", async () => {
      await request(app.getHttpServer())
        .post('/api/projects')
        .set('Cookie', jeu.a.session)
        .send({
          title: ' ',
          links: [{ label: 'Piège', url: 'javascript:alert(1)' }],
        })
        .expect(400)
        .expect(champsEnErreur(['title', 'links.0.url']));
    });

    it("n'accepte pas d'Espace saisi : le Projet reste dans l'Espace personnel", async () => {
      const projet = await creer(jeu.a, {
        title: 'Projet qui voudrait aller au Foyer',
        scopeId: jeu.espaceFoyer,
      });

      expect(projet.scopeId).toBe(jeu.a.espacePersonnel);
    });

    it("n'accepte rien sans session", async () => {
      await request(app.getHttpServer())
        .post('/api/projects')
        .send({ title: 'Sans session' })
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('GET /projects', () => {
    it('liste les Projets du Compte avec le total de leurs dépenses, jamais ceux de l’autre', async () => {
      const deA = await creer(jeu.a, { title: 'Liste : Projet de A' });
      const deB = await creer(jeu.b, { title: 'Liste : Projet de B' });
      await ajouterUneDepense(jeu.a, deA.id, { cents: 1999 });
      await ajouterUneDepense(jeu.a, deA.id, { cents: 1 });

      const reponse = await request(app.getHttpServer())
        .get('/api/projects')
        .set('Cookie', jeu.a.session)
        .expect(200)
        .expect(conformeA(DES_PROJETS));

      const ids = reponse.body.map(({ id }: { id: string }) => id);
      expect(ids).toContain(deA.id);
      expect(ids).not.toContain(deB.id);
      expect(
        reponse.body.find(({ id }: { id: string }) => id === deA.id),
      ).toMatchObject({ totalSpent: { cents: 2000, currency: 'EUR' } });
    });

    it("n'expose rien sans session", async () => {
      await request(app.getHttpServer())
        .get('/api/projects')
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('GET /projects/:id', () => {
    it('rend le Projet, ses dépenses de la plus récente à la plus ancienne et leur total exact', async () => {
      const projet = await creer(jeu.a, { title: 'Lecture : un Projet' });
      for (let i = 0; i < 30; i++) {
        await ajouterUneDepense(jeu.a, projet.id, {
          cents: 10,
          spentOn: '2026-09-01',
        });
      }
      await ajouterUneDepense(jeu.a, projet.id, {
        cents: 1299,
        spentOn: '2026-10-12',
        label: 'Nom de domaine',
      });

      const reponse = await request(app.getHttpServer())
        .get(`/api/projects/${projet.id}`)
        .set('Cookie', jeu.a.session)
        .expect(200)
        .expect(conformeA(UN_PROJET));

      expect(reponse.body.expenses).toHaveLength(31);
      expect(reponse.body.expenses[0]).toMatchObject({
        projectId: projet.id,
        label: 'Nom de domaine',
        amount: { cents: 1299, currency: 'EUR' },
        spentOn: '2026-10-12',
      });
      // 30 × 0,10 € + 12,99 € : des euros flottants donneraient 15,989999…
      expect(reponse.body.totalSpent).toEqual({ cents: 1599, currency: 'EUR' });
    });

    it("rend 404 sur le Projet de l'autre Compte, comme sur un Projet inconnu", async () => {
      const deB = await creer(jeu.b, { title: 'Lecture : Projet de B' });

      for (const id of [deB.id, INCONNU]) {
        await request(app.getHttpServer())
          .get(`/api/projects/${id}`)
          .set('Cookie', jeu.a.session)
          .expect(404)
          .expect(codeDErreur('project.not_found'));
      }
    });

    it("n'expose rien sans session", async () => {
      await request(app.getHttpServer())
        .get(`/api/projects/${INCONNU}`)
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('PATCH /projects/:id', () => {
    it('ne change que ce que la modification porte', async () => {
      const projet = await creer(jeu.a, {
        title: 'Modification : avant',
        notes: 'Des notes à garder',
      });

      const reponse = await request(app.getHttpServer())
        .patch(`/api/projects/${projet.id}`)
        .set('Cookie', jeu.a.session)
        .send({
          title: 'Modification : après',
          links: [{ label: 'Maquette', url: 'http://maquette.exemple.test' }],
        })
        .expect(200)
        .expect(conformeA(UN_PROJET));

      expect(reponse.body).toMatchObject({
        title: 'Modification : après',
        notes: 'Des notes à garder',
        links: [{ label: 'Maquette', url: 'http://maquette.exemple.test' }],
      });
    });

    it('refuse en 400 un titre vide', async () => {
      const projet = await creer(jeu.a, { title: 'Modification : titre' });

      await request(app.getHttpServer())
        .patch(`/api/projects/${projet.id}`)
        .set('Cookie', jeu.a.session)
        .send({ title: '' })
        .expect(400)
        .expect(champsEnErreur(['title']));
    });

    it('refuse en 422 une modification qui ne change rien', async () => {
      const projet = await creer(jeu.a, { title: 'Modification : vide' });

      await request(app.getHttpServer())
        .patch(`/api/projects/${projet.id}`)
        .set('Cookie', jeu.a.session)
        .send({})
        .expect(422)
        .expect(codeDErreur('project.empty_update'));
    });

    it("rend 404 sur le Projet de l'autre Compte, et n'y touche pas", async () => {
      const deB = await creer(jeu.b, { title: 'Modification : Projet de B' });

      await request(app.getHttpServer())
        .patch(`/api/projects/${deB.id}`)
        .set('Cookie', jeu.a.session)
        .send({ title: 'Détourné' })
        .expect(404)
        .expect(codeDErreur('project.not_found'));

      expect((await lire(jeu.b, deB.id)).title).toBe(
        'Modification : Projet de B',
      );
    });

    it("n'accepte rien sans session", async () => {
      await request(app.getHttpServer())
        .patch(`/api/projects/${INCONNU}`)
        .send({ title: 'Sans session' })
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('DELETE /projects/:id', () => {
    it('supprime le Projet et ses dépenses', async () => {
      const projet = await creer(jeu.a, { title: 'Suppression : un Projet' });
      await ajouterUneDepense(jeu.a, projet.id, { cents: 500 });

      await request(app.getHttpServer())
        .delete(`/api/projects/${projet.id}`)
        .set('Cookie', jeu.a.session)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/api/projects/${projet.id}`)
        .set('Cookie', jeu.a.session)
        .expect(404);
    });

    it("rend 404 sur le Projet de l'autre Compte, et le laisse en place", async () => {
      const deB = await creer(jeu.b, { title: 'Suppression : Projet de B' });

      await request(app.getHttpServer())
        .delete(`/api/projects/${deB.id}`)
        .set('Cookie', jeu.a.session)
        .expect(404)
        .expect(codeDErreur('project.not_found'));

      await lire(jeu.b, deB.id);
    });

    it("n'accepte rien sans session", async () => {
      await request(app.getHttpServer())
        .delete(`/api/projects/${INCONNU}`)
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('POST /projects/:id/expenses', () => {
    it('ajoute une dépense, conforme au contrat, et la compte dans le total', async () => {
      const projet = await creer(jeu.a, { title: 'Dépense : un Projet' });
      await ajouterUneDepense(jeu.a, projet.id, { cents: 4000 });

      const reponse = await request(app.getHttpServer())
        .post(`/api/projects/${projet.id}/expenses`)
        .set('Cookie', jeu.a.session)
        .send({
          label: '  Hébergement ',
          amount: { cents: 599 },
          spentOn: '2026-10-01',
        })
        .expect(201)
        .expect(conformeA(UNE_DEPENSE));

      expect(reponse.body).toMatchObject({
        projectId: projet.id,
        label: 'Hébergement',
        amount: { cents: 599, currency: 'EUR' },
        spentOn: '2026-10-01',
      });
      expect((await lire(jeu.a, projet.id)).totalSpent).toEqual({
        cents: 4599,
        currency: 'EUR',
      });
    });

    it('refuse en 400 un montant qui ne serait pas un entier de centimes', async () => {
      const projet = await creer(jeu.a, { title: 'Dépense : montant' });

      await request(app.getHttpServer())
        .post(`/api/projects/${projet.id}/expenses`)
        .set('Cookie', jeu.a.session)
        .send({ label: '', amount: { cents: 12.5 }, spentOn: '12/10/2026' })
        .expect(400)
        .expect(champsEnErreur(['label', 'amount.cents', 'spentOn']));
    });

    it("rend 404 sur le Projet de l'autre Compte, et n'y ajoute rien", async () => {
      const deB = await creer(jeu.b, { title: 'Dépense : Projet de B' });

      for (const id of [deB.id, INCONNU]) {
        await request(app.getHttpServer())
          .post(`/api/projects/${id}/expenses`)
          .set('Cookie', jeu.a.session)
          .send({
            label: 'Intrusion',
            amount: { cents: 100 },
            spentOn: '2026-10-01',
          })
          .expect(404)
          .expect(codeDErreur('project.not_found'));
      }

      expect((await lire(jeu.b, deB.id)).expenses).toEqual([]);
    });

    it("n'accepte rien sans session", async () => {
      await request(app.getHttpServer())
        .post(`/api/projects/${INCONNU}/expenses`)
        .send({
          label: 'Sans session',
          amount: { cents: 1 },
          spentOn: '2026-10-01',
        })
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('DELETE /projects/:id/expenses/:expenseId', () => {
    it('retire la dépense du Projet et de son total', async () => {
      const projet = await creer(jeu.a, { title: 'Retrait : un Projet' });
      const gardee = await ajouterUneDepense(jeu.a, projet.id, { cents: 700 });
      const retiree = await ajouterUneDepense(jeu.a, projet.id, { cents: 300 });

      await request(app.getHttpServer())
        .delete(`/api/projects/${projet.id}/expenses/${retiree.id}`)
        .set('Cookie', jeu.a.session)
        .expect(204);

      const relu = await lire(jeu.a, projet.id);
      expect(relu.expenses.map(({ id }) => id)).toEqual([gardee.id]);
      expect(relu.totalSpent).toEqual({ cents: 700, currency: 'EUR' });
    });

    it("rend 404 sur une dépense d'un autre Projet du même Compte", async () => {
      const premier = await creer(jeu.a, { title: 'Retrait : premier' });
      const second = await creer(jeu.a, { title: 'Retrait : second' });
      const depense = await ajouterUneDepense(jeu.a, second.id, { cents: 100 });

      await request(app.getHttpServer())
        .delete(`/api/projects/${premier.id}/expenses/${depense.id}`)
        .set('Cookie', jeu.a.session)
        .expect(404)
        .expect(codeDErreur('project.expense_not_found'));

      expect((await lire(jeu.a, second.id)).expenses).toHaveLength(1);
    });

    it("rend 404 sur la dépense d'un Projet de l'autre Compte, et la laisse en place", async () => {
      const deB = await creer(jeu.b, { title: 'Retrait : Projet de B' });
      const depense = await ajouterUneDepense(jeu.b, deB.id, { cents: 100 });

      await request(app.getHttpServer())
        .delete(`/api/projects/${deB.id}/expenses/${depense.id}`)
        .set('Cookie', jeu.a.session)
        .expect(404)
        .expect(codeDErreur('project.not_found'));

      expect((await lire(jeu.b, deB.id)).expenses).toHaveLength(1);
    });

    it("n'accepte rien sans session", async () => {
      await request(app.getHttpServer())
        .delete(`/api/projects/${INCONNU}/expenses/${INCONNU}`)
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  async function creer(
    compte: CompteDeTest,
    saisie: Record<string, unknown>,
  ): Promise<Project> {
    const reponse = await request(app.getHttpServer())
      .post('/api/projects')
      .set('Cookie', compte.session)
      .send(saisie)
      .expect(201);

    return reponse.body;
  }

  async function lire(compte: CompteDeTest, id: string): Promise<Project> {
    const reponse = await request(app.getHttpServer())
      .get(`/api/projects/${id}`)
      .set('Cookie', compte.session)
      .expect(200);

    return reponse.body;
  }

  async function ajouterUneDepense(
    compte: CompteDeTest,
    projectId: string,
    {
      cents,
      spentOn = '2026-10-15',
      label = 'Une dépense',
    }: { cents: number; spentOn?: string; label?: string },
  ): Promise<ProjectExpense> {
    const reponse = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/expenses`)
      .set('Cookie', compte.session)
      .send({ label, amount: { cents }, spentOn })
      .expect(201);

    return reponse.body;
  }
});
