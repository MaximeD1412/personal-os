import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { estEcheance, zEvent, type Event } from '@personal-os/contracts';
import request from 'supertest';
import { z } from 'zod';
import {
  demarrerFauxAuthentik,
  type FauxAuthentik,
} from '../../../test/faux-authentik';
import {
  poserLeJeuDEspaces,
  type JeuDEspaces,
} from '../../../test/jeu-d-espaces';
import { champsEnErreur, codeDErreur } from '../../../test/code-d-erreur';
import { conformeA } from '../../../test/conforme';
import { AppModule } from '../app.module';

const REDIRECT_URI = 'http://app.exemple.test/api/auth/callback';
const DASHBOARD_URL = 'http://app.exemple.test/';
const ADRESSE_A = 'a@exemple.test';
const ADRESSE_B = 'b@exemple.test';

/** Un Événement exactement conforme au contrat, sans un champ de plus. */
const UN_EVENEMENT = zEvent.strict();
const DES_EVENEMENTS = z.array(UN_EVENEMENT);

/** De quoi couvrir tous les Événements de cette campagne. */
const TOUT = {
  from: '2026-01-01T00:00:00.000Z',
  to: '2027-12-31T23:59:59.999Z',
};

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

  describe('GET /events', () => {
    it('rend les Événements qui rencontrent la période, conformes au contrat', async () => {
      const dedans = await creer(jeu.a, {
        title: 'Dentiste',
        startsAt: '2026-09-14T09:30:00.000Z',
        category: 'APPOINTMENT',
        scopeId: jeu.a.espacePersonnel,
      });
      const aCheval = await creer(jeu.a, {
        title: 'Vacances à cheval',
        startsAt: '2026-08-25T00:00:00.000Z',
        endsAt: '2026-09-03T00:00:00.000Z',
        category: 'OTHER',
        scopeId: jeu.espaceFoyer,
      });
      const apres = await creer(jeu.a, {
        title: 'Bien après',
        startsAt: '2026-10-02T09:00:00.000Z',
        category: 'OTHER',
        scopeId: jeu.a.espacePersonnel,
      });

      const reponse = await request(app.getHttpServer())
        .get('/api/events')
        .query({
          from: '2026-09-01T00:00:00.000Z',
          to: '2026-09-30T23:59:59.999Z',
        })
        .set('Cookie', jeu.a.session)
        .expect(200)
        .expect(conformeA(DES_EVENEMENTS));

      const ids = (reponse.body as Event[]).map(({ id }) => id);
      expect(ids).toContain(dedans.id);
      expect(ids).toContain(aCheval.id);
      expect(ids).not.toContain(apres.id);
    });

    it('refuse en 400 une lecture sans période', async () => {
      await request(app.getHttpServer())
        .get('/api/events')
        .set('Cookie', jeu.a.session)
        .expect(400)
        .expect(champsEnErreur(['from', 'to']));

      await request(app.getHttpServer())
        .get('/api/events')
        .query({ from: TOUT.from })
        .set('Cookie', jeu.a.session)
        .expect(400)
        .expect(champsEnErreur(['to']));
    });

    it('refuse en 400 une période qui finit avant de commencer', async () => {
      await request(app.getHttpServer())
        .get('/api/events')
        .query({ from: TOUT.to, to: TOUT.from })
        .set('Cookie', jeu.a.session)
        .expect(400)
        .expect(champsEnErreur(['to']));
    });

    it("ne rend jamais un Événement de l'Espace personnel de l'autre", async () => {
      const sien = await creer(jeu.b, {
        title: 'Secret de B',
        startsAt: '2026-09-24T10:00:00.000Z',
        category: 'APPOINTMENT',
        scopeId: jeu.b.espacePersonnel,
      });

      expect((await lister(jeu.a)).map(({ id }) => id)).not.toContain(sien.id);
      expect((await lister(jeu.b)).map(({ id }) => id)).toContain(sien.id);
    });

    it("rend aux deux Comptes le même Événement de l'Espace foyer", async () => {
      const commun = await creer(jeu.a, {
        title: 'Vacances communes',
        startsAt: '2026-09-26T10:00:00.000Z',
        category: 'OTHER',
        scopeId: jeu.espaceFoyer,
      });

      for (const compte of [jeu.a, jeu.b]) {
        expect((await lister(compte)).map(({ id }) => id)).toContain(commun.id);
      }
    });

    it("n'expose rien sans session", async () => {
      await request(app.getHttpServer())
        .get('/api/events')
        .query(TOUT)
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('POST /events', () => {
    it("crée un Événement dans l'Espace choisi, conforme au contrat", async () => {
      const reponse = await request(app.getHttpServer())
        .post('/api/events')
        .set('Cookie', jeu.a.session)
        .send({
          title: '  Dentiste  ',
          startsAt: '2026-09-14T09:30:00.000Z',
          category: 'APPOINTMENT',
          scopeId: jeu.a.espacePersonnel,
        })
        .expect(201)
        .expect(conformeA(UN_EVENEMENT));

      expect(reponse.body).toMatchObject({
        title: 'Dentiste',
        startsAt: '2026-09-14T09:30:00.000Z',
        endsAt: null,
        category: 'APPOINTMENT',
        reminderLeadMinutes: null,
        scopeId: jeu.a.espacePersonnel,
      });
      expect((await lister(jeu.a)).map(({ id }) => id)).toContain(
        (reponse.body as Event).id,
      );
    });

    it('garde la période quand une fin est donnée, même égale au début', async () => {
      const vacances = await creer(jeu.a, {
        title: 'Vacances',
        startsAt: '2026-08-01T00:00:00.000Z',
        endsAt: '2026-08-15T00:00:00.000Z',
        category: 'OTHER',
        scopeId: jeu.espaceFoyer,
      });
      const instant = await creer(jeu.a, {
        title: 'Un instant',
        startsAt: '2026-08-02T00:00:00.000Z',
        endsAt: '2026-08-02T00:00:00.000Z',
        category: 'OTHER',
        scopeId: jeu.espaceFoyer,
      });

      expect(vacances.endsAt).toBe('2026-08-15T00:00:00.000Z');
      expect(instant.endsAt).toBe('2026-08-02T00:00:00.000Z');
    });

    it.each([
      ['qui ne nomme aucun Espace', { scopeId: undefined }, 'scopeId'],
      ['dont l’Espace est vide', { scopeId: '   ' }, 'scopeId'],
      ['sans intitulé', { title: '' }, 'title'],
      ["dont le début n'est pas un instant", { startsAt: 'mardi' }, 'startsAt'],
      ['de catégorie inconnue', { category: 'ECHEANCE' }, 'category'],
      [
        'au rappel négatif',
        { reminderLeadMinutes: -30 },
        'reminderLeadMinutes',
      ],
      [
        'au rappel fractionnaire',
        { reminderLeadMinutes: 12.5 },
        'reminderLeadMinutes',
      ],
    ])('refuse en 400 une création %s', async (_cas, ecart, champ) => {
      await request(app.getHttpServer())
        .post('/api/events')
        .set('Cookie', jeu.a.session)
        .send({
          title: 'Dentiste',
          startsAt: '2026-09-14T09:30:00.000Z',
          category: 'APPOINTMENT',
          scopeId: jeu.a.espacePersonnel,
          ...ecart,
        })
        .expect(400)
        .expect(champsEnErreur([champ]));
    });

    it('refuse en 422 un Événement qui finit avant de commencer', async () => {
      await request(app.getHttpServer())
        .post('/api/events')
        .set('Cookie', jeu.a.session)
        .send({
          title: 'À l’envers',
          startsAt: '2026-09-14T09:30:00.000Z',
          endsAt: '2026-09-14T08:00:00.000Z',
          category: 'OTHER',
          scopeId: jeu.a.espacePersonnel,
        })
        .expect(422)
        .expect(codeDErreur('event.period_reversed'));
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
        .expect(403)
        .expect(codeDErreur('scope.out_of_reach'));
    });

    it("n'écrit rien sans session", async () => {
      await request(app.getHttpServer())
        .post('/api/events')
        .send({
          title: 'Anonyme',
          startsAt: '2026-09-23T10:00:00.000Z',
          category: 'OTHER',
          scopeId: jeu.espaceFoyer,
        })
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('PATCH /events/:id', () => {
    it('modifie un Événement, conforme au contrat, et la modification se relit', async () => {
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
        .expect(200)
        .expect(conformeA(UN_EVENEMENT));

      expect(modifie.body).toMatchObject({
        title: 'Précisé',
        category: 'APPOINTMENT',
        startsAt: cree.startsAt,
      });
      expect(
        (await lister(jeu.a)).find(({ id }) => id === cree.id)?.title,
      ).toBe('Précisé');
    });

    it('refuse en 400 une modification hors contrat', async () => {
      const cree = await creer(jeu.a, {
        title: 'Rappel',
        startsAt: '2026-09-20T10:00:00.000Z',
        category: 'OTHER',
        scopeId: jeu.a.espacePersonnel,
      });

      await request(app.getHttpServer())
        .patch(`/api/events/${cree.id}`)
        .set('Cookie', jeu.a.session)
        .send({ reminderLeadMinutes: 1.5 })
        .expect(400)
        .expect(champsEnErreur(['reminderLeadMinutes']));
    });

    it("refuse en 422 une modification qui ferait finir l'Événement avant son début", async () => {
      const cree = await creer(jeu.a, {
        title: 'Vacances',
        startsAt: '2026-08-01T00:00:00.000Z',
        endsAt: '2026-08-15T00:00:00.000Z',
        category: 'OTHER',
        scopeId: jeu.espaceFoyer,
      });

      // Seule la fin est modifiée : le début n'est pas dans la saisie, et la
      // période ne se juge donc qu'en relisant l'Événement.
      await request(app.getHttpServer())
        .patch(`/api/events/${cree.id}`)
        .set('Cookie', jeu.a.session)
        .send({ endsAt: '2026-07-20T00:00:00.000Z' })
        .expect(422)
        .expect(codeDErreur('event.period_reversed'));

      const relu = (await lister(jeu.a)).find(({ id }) => id === cree.id);
      expect(relu?.endsAt).toBe('2026-08-15T00:00:00.000Z');
    });

    it('refuse en 422 une modification qui ne change rien', async () => {
      const cree = await creer(jeu.a, {
        title: 'Inchangé',
        startsAt: '2026-09-20T10:00:00.000Z',
        category: 'OTHER',
        scopeId: jeu.a.espacePersonnel,
      });

      await request(app.getHttpServer())
        .patch(`/api/events/${cree.id}`)
        .set('Cookie', jeu.a.session)
        .send({})
        .expect(422)
        .expect(codeDErreur('event.empty_update'));
    });

    it("rend 404 sur l'Événement de l'Espace personnel de l'autre, et n'y touche pas", async () => {
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
        .expect(404)
        .expect(codeDErreur('event.not_found'));

      // Toucher une borne fait relire l'Événement : la relecture ne doit pas
      // davantage trahir son existence.
      await request(app.getHttpServer())
        .patch(`/api/events/${sien.id}`)
        .set('Cookie', jeu.a.session)
        .send({ endsAt: '2026-09-01T00:00:00.000Z' })
        .expect(404)
        .expect(codeDErreur('event.not_found'));

      expect(
        (await lister(jeu.b)).find(({ id }) => id === sien.id)?.title,
      ).toBe('À deviner');
    });

    it("n'écrit rien sans session", async () => {
      const cree = await creer(jeu.a, {
        title: 'Protégé',
        startsAt: '2026-09-20T10:00:00.000Z',
        category: 'OTHER',
        scopeId: jeu.a.espacePersonnel,
      });

      await request(app.getHttpServer())
        .patch(`/api/events/${cree.id}`)
        .send({ title: 'Anonyme' })
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('DELETE /events/:id', () => {
    it('supprime un Événement, qui disparaît de la liste', async () => {
      const cree = await creer(jeu.a, {
        title: 'Annulé',
        startsAt: '2026-09-21T10:00:00.000Z',
        category: 'OTHER',
        scopeId: jeu.a.espacePersonnel,
      });

      const reponse = await request(app.getHttpServer())
        .delete(`/api/events/${cree.id}`)
        .set('Cookie', jeu.a.session)
        .expect(204);

      expect(reponse.text).toBe('');
      expect((await lister(jeu.a)).map(({ id }) => id)).not.toContain(cree.id);
    });

    it("rend 404 sur l'Événement de l'Espace personnel de l'autre, et le laisse en place", async () => {
      const sien = await creer(jeu.b, {
        title: 'À garder',
        startsAt: '2026-09-25T10:00:00.000Z',
        category: 'APPOINTMENT',
        scopeId: jeu.b.espacePersonnel,
      });

      await request(app.getHttpServer())
        .delete(`/api/events/${sien.id}`)
        .set('Cookie', jeu.a.session)
        .expect(404)
        .expect(codeDErreur('event.not_found'));

      expect((await lister(jeu.b)).map(({ id }) => id)).toContain(sien.id);
    });

    it('ne supprime rien sans session', async () => {
      const cree = await creer(jeu.a, {
        title: 'Protégé',
        startsAt: '2026-09-21T10:00:00.000Z',
        category: 'OTHER',
        scopeId: jeu.a.espacePersonnel,
      });

      await request(app.getHttpServer())
        .delete(`/api/events/${cree.id}`)
        .expect(401)
        .expect(codeDErreur('auth.required'));
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
      .query(TOUT)
      .set('Cookie', compte.session)
      .expect(200);

    return reponse.body;
  }
});
