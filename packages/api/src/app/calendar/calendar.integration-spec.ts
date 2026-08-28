import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { estEcheance, type Event } from '@personal-os/contracts';
import request from 'supertest';
import {
  demarrerFauxAuthentik,
  type FauxAuthentik,
} from '../../../test/faux-authentik';
import {
  poserLeJeuDEspaces,
  type JeuDEspaces,
} from '../../../test/jeu-d-espaces';
import { AppModule } from '../app.module';

const REDIRECT_URI = 'http://app.exemple.test/api/auth/callback';
const DASHBOARD_URL = 'http://app.exemple.test/';
const ADRESSE_A = 'a@exemple.test';
const ADRESSE_B = 'b@exemple.test';

describe('Calendrier', () => {
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

  describe("Le cycle de vie d'un Événement", () => {
    it("crée un Événement dans l'Espace choisi, et le relit", async () => {
      const cree = await request(app.getHttpServer())
        .post('/api/events')
        .set('Cookie', jeu.a.session)
        .send({
          title: 'Dentiste',
          startsAt: '2026-09-14T09:30:00.000Z',
          category: 'APPOINTMENT',
          scopeId: jeu.a.espacePersonnel,
        })
        .expect(201);

      expect(cree.body).toMatchObject({
        title: 'Dentiste',
        startsAt: '2026-09-14T09:30:00.000Z',
        endsAt: null,
        category: 'APPOINTMENT',
        reminderLeadMinutes: null,
        scopeId: jeu.a.espacePersonnel,
      });

      const listes = await request(app.getHttpServer())
        .get('/api/events')
        .set('Cookie', jeu.a.session)
        .expect(200);

      expect((listes.body as Event[]).map(({ id }) => id)).toContain(
        (cree.body as Event).id,
      );
    });

    it('garde la période quand une fin est donnée', async () => {
      const cree = await creer(jeu.a, {
        title: 'Vacances',
        startsAt: '2026-08-01T00:00:00.000Z',
        endsAt: '2026-08-15T00:00:00.000Z',
        category: 'OTHER',
        scopeId: jeu.espaceFoyer,
      });

      expect(cree.endsAt).toBe('2026-08-15T00:00:00.000Z');
    });

    it('modifie un Événement, et la modification se relit', async () => {
      const cree = await creer(jeu.a, {
        title: 'À préciser',
        startsAt: '2026-09-20T10:00:00.000Z',
        category: 'OTHER',
        scopeId: jeu.a.espacePersonnel,
      });

      const modifie = await request(app.getHttpServer())
        .patch(`/api/events/${cree.id}`)
        .set('Cookie', jeu.a.session)
        .send({ title: 'Précisé', category: 'APPOINTMENT' })
        .expect(200);

      expect(modifie.body).toMatchObject({
        title: 'Précisé',
        category: 'APPOINTMENT',
      });
    });

    it("refuse une modification qui ferait finir l'Événement avant son début", async () => {
      const cree = await creer(jeu.a, {
        title: 'Vacances',
        startsAt: '2026-08-01T00:00:00.000Z',
        endsAt: '2026-08-15T00:00:00.000Z',
        category: 'OTHER',
        scopeId: jeu.espaceFoyer,
      });

      // Seule la fin est modifiée : le début n'est pas dans la saisie, et la
      // période ne se contrôle donc qu'en relisant l'Événement.
      await request(app.getHttpServer())
        .patch(`/api/events/${cree.id}`)
        .set('Cookie', jeu.a.session)
        .send({ endsAt: '2026-07-20T00:00:00.000Z' })
        .expect(400);

      const relu = (await lister(jeu.a)).find(({ id }) => id === cree.id);
      expect(relu?.endsAt).toBe('2026-08-15T00:00:00.000Z');
    });

    it("supprime un Événement, qui disparaît de la liste", async () => {
      const cree = await creer(jeu.a, {
        title: 'Annulé',
        startsAt: '2026-09-21T10:00:00.000Z',
        category: 'OTHER',
        scopeId: jeu.a.espacePersonnel,
      });

      await request(app.getHttpServer())
        .delete(`/api/events/${cree.id}`)
        .set('Cookie', jeu.a.session)
        .expect(204);

      expect((await lister(jeu.a)).map(({ id }) => id)).not.toContain(cree.id);
    });
  });

  describe("L'Espace, choisi et jamais deviné", () => {
    it("refuse une création qui ne nomme aucun Espace", async () => {
      await request(app.getHttpServer())
        .post('/api/events')
        .set('Cookie', jeu.a.session)
        .send({
          title: 'Sans espace',
          startsAt: '2026-09-14T09:30:00.000Z',
          category: 'OTHER',
        })
        .expect(400);
    });

    it("accepte l'Espace personnel comme celui du Foyer", async () => {
      for (const scopeId of [jeu.a.espacePersonnel, jeu.espaceFoyer]) {
        const cree = await creer(jeu.a, {
          title: 'Des deux côtés',
          startsAt: '2026-09-22T10:00:00.000Z',
          category: 'OTHER',
          scopeId,
        });

        expect(cree.scopeId).toBe(scopeId);
      }
    });

    it("refuse d'écrire dans l'Espace personnel de l'autre", async () => {
      await request(app.getHttpServer())
        .post('/api/events')
        .set('Cookie', jeu.a.session)
        .send({
          title: 'Intrusion',
          startsAt: '2026-09-23T10:00:00.000Z',
          category: 'OTHER',
          scopeId: jeu.b.espacePersonnel,
        })
        .expect(403);
    });
  });

  describe("Ce qu'un Compte ne voit pas", () => {
    it("ne rend jamais un Événement de l'Espace personnel de l'autre", async () => {
      const sien = await creer(jeu.b, {
        title: 'Secret de B',
        startsAt: '2026-09-24T10:00:00.000Z',
        category: 'APPOINTMENT',
        scopeId: jeu.b.espacePersonnel,
      });

      expect((await lister(jeu.a)).map(({ id }) => id)).not.toContain(sien.id);
    });

    it("ne le rend pas davantage à qui devine son identifiant", async () => {
      const sien = await creer(jeu.b, {
        title: 'À deviner',
        startsAt: '2026-09-25T10:00:00.000Z',
        category: 'APPOINTMENT',
        scopeId: jeu.b.espacePersonnel,
      });

      await request(app.getHttpServer())
        .patch(`/api/events/${sien.id}`)
        .set('Cookie', jeu.a.session)
        .send({ title: 'Volé' })
        .expect(404);

      await request(app.getHttpServer())
        .delete(`/api/events/${sien.id}`)
        .set('Cookie', jeu.a.session)
        .expect(404);

      expect(
        (await lister(jeu.b)).find(({ id }) => id === sien.id)?.title,
      ).toBe('À deviner');
    });

    it("rend aux deux Comptes le même Événement de l'Espace foyer", async () => {
      const commun = await creer(jeu.a, {
        title: 'Vacances communes',
        startsAt: '2026-09-26T10:00:00.000Z',
        category: 'OTHER',
        scopeId: jeu.espaceFoyer,
      });

      for (const compte of [jeu.a, jeu.b]) {
        expect((await lister(compte)).map(({ id }) => id)).toContain(
          commun.id,
        );
      }
    });

    it("n'expose rien sans session", async () => {
      await request(app.getHttpServer()).get('/api/events').expect(401);
    });
  });

  describe("L'Échéance et le rappel, qui ne sont pas des objets", () => {
    it("fait d'un Événement une Échéance par sa seule catégorie", async () => {
      const echeance = await creer(jeu.a, {
        title: 'Déclaration de revenus',
        startsAt: '2027-05-20T00:00:00.000Z',
        category: 'DEADLINE',
        scopeId: jeu.a.espacePersonnel,
      });

      expect(estEcheance(echeance)).toBe(true);

      const rendezVous = await creer(jeu.a, {
        title: 'Dentiste',
        startsAt: '2026-09-27T10:00:00.000Z',
        category: 'APPOINTMENT',
        scopeId: jeu.a.espacePersonnel,
      });

      expect(estEcheance(rendezVous)).toBe(false);
    });

    it('pose un délai de rappel, et le relit tel quel', async () => {
      const cree = await creer(jeu.a, {
        title: 'Fin de garantie',
        startsAt: '2027-01-10T00:00:00.000Z',
        category: 'DEADLINE',
        reminderLeadMinutes: 10_080,
        scopeId: jeu.a.espacePersonnel,
      });

      expect(cree.reminderLeadMinutes).toBe(10_080);

      const relu = (await lister(jeu.a)).find(({ id }) => id === cree.id);
      expect(relu?.reminderLeadMinutes).toBe(10_080);
    });

    it('accepte de retirer un délai de rappel déjà posé', async () => {
      const cree = await creer(jeu.a, {
        title: 'Rappel à retirer',
        startsAt: '2027-02-10T00:00:00.000Z',
        category: 'DEADLINE',
        reminderLeadMinutes: 60,
        scopeId: jeu.a.espacePersonnel,
      });

      const modifie = await request(app.getHttpServer())
        .patch(`/api/events/${cree.id}`)
        .set('Cookie', jeu.a.session)
        .send({ reminderLeadMinutes: null })
        .expect(200);

      expect((modifie.body as Event).reminderLeadMinutes).toBeNull();
    });
  });

  async function creer(
    compte: JeuDEspaces['a'],
    saisie: Record<string, unknown>,
  ): Promise<Event> {
    const reponse = await request(app.getHttpServer())
      .post('/api/events')
      .set('Cookie', compte.session)
      .send(saisie)
      .expect(201);

    return reponse.body;
  }

  async function lister(compte: JeuDEspaces['a']): Promise<Event[]> {
    const reponse = await request(app.getHttpServer())
      .get('/api/events')
      .set('Cookie', compte.session)
      .expect(200);

    return reponse.body;
  }
});
