import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  estEcheance,
  zEvent,
  zEventOccurrence,
  type Event,
  type EventOccurrence,
} from '@personal-os/contracts';
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
import {
  compterLesExceptions,
  poserDesExceptions,
} from '../../../test/exceptions-d-occurrence';
import { AppModule } from '../app.module';

const REDIRECT_URI = 'http://app.exemple.test/api/auth/callback';
const DASHBOARD_URL = 'http://app.exemple.test/';
const ADRESSE_A = 'a@exemple.test';
const ADRESSE_B = 'b@exemple.test';

/** Un Événement exactement conforme au contrat, sans un champ de plus. */
const UN_EVENEMENT = zEvent.strict();
/** Une lecture rend des occurrences, chacune exactement conforme. */
const DES_OCCURRENCES = z.array(zEventOccurrence.strict());

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
        .expect(conformeA(DES_OCCURRENCES));

      const ids = (reponse.body as EventOccurrence[]).map(
        ({ eventId }) => eventId,
      );
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

      expect((await lister(jeu.a)).map(({ eventId }) => eventId)).not.toContain(
        sien.id,
      );
      expect((await lister(jeu.b)).map(({ eventId }) => eventId)).toContain(
        sien.id,
      );
    });

    it("rend aux deux Comptes le même Événement de l'Espace foyer", async () => {
      const commun = await creer(jeu.a, {
        title: 'Vacances communes',
        startsAt: '2026-09-26T10:00:00.000Z',
        category: 'OTHER',
        scopeId: jeu.espaceFoyer,
      });

      for (const compte of [jeu.a, jeu.b]) {
        expect((await lister(compte)).map(({ eventId }) => eventId)).toContain(
          commun.id,
        );
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
      expect((await lister(jeu.a)).map(({ eventId }) => eventId)).toContain(
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
        (await lister(jeu.a)).find(({ eventId }) => eventId === cree.id)?.title,
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

      const relu = (await lister(jeu.a)).find(
        ({ eventId }) => eventId === cree.id,
      );
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
        (await lister(jeu.b)).find(({ eventId }) => eventId === sien.id)?.title,
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
      expect((await lister(jeu.a)).map(({ eventId }) => eventId)).not.toContain(
        cree.id,
      );
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

      expect((await lister(jeu.b)).map(({ eventId }) => eventId)).toContain(
        sien.id,
      );
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

  describe('La récurrence, calculée à la lecture', () => {
    /*
     * 2029, que les autres cas n'occupent pas. Le 25 mars 2029, Paris passe à
     * l'heure d'été : une réunion à 9 h y passe de 08:00Z à 07:00Z.
     */
    const MARS_2029 = {
      from: '2029-02-28T23:00:00.000Z',
      to: '2029-03-31T21:59:59.999Z',
    };
    const CHAQUE_LUNDI = { freq: 'WEEKLY', interval: 1 } as const;

    const occurrencesDe = async (
      compte: JeuDEspaces['a'],
      evenement: { id: string },
      periode = MARS_2029,
    ) =>
      (await lister(compte, periode)).filter(
        ({ eventId }) => eventId === evenement.id,
      );

    it('crée une série, et en rend chaque occurrence de la période, conforme au contrat', async () => {
      const serie = await request(app.getHttpServer())
        .post('/api/events')
        .set('Cookie', jeu.a.session)
        .send({
          title: 'Point du lundi',
          startsAt: '2029-03-05T08:00:00.000Z', // lundi 9 h
          endsAt: '2029-03-05T08:30:00.000Z',
          category: 'OTHER',
          recurrence: CHAQUE_LUNDI,
          scopeId: jeu.a.espacePersonnel,
        })
        .expect(201)
        .expect(conformeA(UN_EVENEMENT));
      expect(serie.body.recurrence).toEqual(CHAQUE_LUNDI);

      await request(app.getHttpServer())
        .get('/api/events')
        .query(MARS_2029)
        .set('Cookie', jeu.a.session)
        .expect(200)
        .expect(conformeA(DES_OCCURRENCES));

      const occurrences = await occurrencesDe(jeu.a, serie.body);
      expect(occurrences[0]).toEqual({
        eventId: serie.body.id,
        originalStart: '2029-03-05T08:00:00.000Z',
        isRecurring: true,
        title: 'Point du lundi',
        startsAt: '2029-03-05T08:00:00.000Z',
        endsAt: '2029-03-05T08:30:00.000Z',
        category: 'OTHER',
        reminderLeadMinutes: null,
        recurrence: CHAQUE_LUNDI,
        scopeId: jeu.a.espacePersonnel,
      });
      expect(occurrences.map(({ startsAt }) => startsAt)).toEqual([
        '2029-03-05T08:00:00.000Z',
        '2029-03-12T08:00:00.000Z',
        '2029-03-19T08:00:00.000Z',
        '2029-03-26T07:00:00.000Z', // toujours 9 h, à l'heure d'été
      ]);
    });

    it("rend un Événement sans règle en une seule occurrence, qui n'est pas récurrente", async () => {
      const unique = await creer(jeu.a, {
        title: 'Une seule fois',
        startsAt: '2029-03-07T10:00:00.000Z',
        category: 'OTHER',
        scopeId: jeu.a.espacePersonnel,
      });

      expect(unique.recurrence).toBeNull();
      expect(await occurrencesDe(jeu.a, unique)).toEqual([
        expect.objectContaining({
          originalStart: '2029-03-07T10:00:00.000Z',
          isRecurring: false,
        }),
      ]);
    });

    it("s'arrête à la fin de la règle, par nombre comme par date", async () => {
      const troisFois = await creer(jeu.a, {
        title: 'Trois fois',
        startsAt: '2029-03-01T17:00:00.000Z',
        category: 'OTHER',
        recurrence: { freq: 'DAILY', interval: 1, count: 3 },
        scopeId: jeu.a.espacePersonnel,
      });
      const jusquAu2 = await creer(jeu.a, {
        title: "Jusqu'au 2",
        startsAt: '2029-03-01T17:00:00.000Z',
        category: 'OTHER',
        recurrence: { freq: 'DAILY', interval: 1, until: '2029-03-02' },
        scopeId: jeu.a.espacePersonnel,
      });

      expect(await occurrencesDe(jeu.a, troisFois)).toHaveLength(3);
      expect(await occurrencesDe(jeu.a, jusquAu2)).toHaveLength(2);
    });

    it("applique les exceptions : une occurrence supprimée, une autre déplacée dans la période depuis l'extérieur", async () => {
      const serie = await creer(jeu.a, {
        title: 'Piscine',
        startsAt: '2029-03-05T17:00:00.000Z',
        category: 'OTHER',
        recurrence: CHAQUE_LUNDI,
        scopeId: jeu.a.espacePersonnel,
      });
      await poserDesExceptions(
        app,
        { id: jeu.a.espacePersonnel, kind: 'PERSONAL' },
        [
          {
            eventId: serie.id,
            originalStart: '2029-03-12T17:00:00.000Z',
            kind: 'CANCELLED',
          },
          {
            eventId: serie.id,
            originalStart: '2029-04-02T16:00:00.000Z', // avril, heure d'été
            kind: 'MODIFIED',
            startsAt: '2029-03-31T09:00:00.000Z',
            title: 'Piscine avancée',
          },
        ],
      );

      expect(
        (await occurrencesDe(jeu.a, serie)).map(
          ({ originalStart, startsAt, title }) => [
            originalStart,
            startsAt,
            title,
          ],
        ),
      ).toEqual([
        ['2029-03-05T17:00:00.000Z', '2029-03-05T17:00:00.000Z', 'Piscine'],
        ['2029-03-19T17:00:00.000Z', '2029-03-19T17:00:00.000Z', 'Piscine'],
        ['2029-03-26T16:00:00.000Z', '2029-03-26T16:00:00.000Z', 'Piscine'],
        [
          '2029-04-02T16:00:00.000Z',
          '2029-03-31T09:00:00.000Z',
          'Piscine avancée',
        ],
      ]);
      expect(
        (
          await occurrencesDe(jeu.a, serie, {
            from: '2029-04-01T00:00:00.000Z',
            to: '2029-04-08T00:00:00.000Z',
          })
        ).map(({ startsAt }) => startsAt),
      ).toEqual([]);
    });

    it('rend une occurrence avancée avant le début de la série, dans la période', async () => {
      const serie = await creer(jeu.a, {
        title: 'Commence en avril',
        startsAt: '2029-04-09T07:00:00.000Z',
        category: 'OTHER',
        recurrence: CHAQUE_LUNDI,
        scopeId: jeu.a.espacePersonnel,
      });
      await poserDesExceptions(
        app,
        { id: jeu.a.espacePersonnel, kind: 'PERSONAL' },
        [
          {
            eventId: serie.id,
            originalStart: '2029-04-09T07:00:00.000Z',
            kind: 'MODIFIED',
            startsAt: '2029-03-30T07:00:00.000Z',
          },
        ],
      );

      expect(
        (await occurrencesDe(jeu.a, serie)).map(({ startsAt }) => startsAt),
      ).toEqual(['2029-03-30T07:00:00.000Z']);
    });

    it("rend l'occurrence dont une exception prolonge la seule fin jusque dans la période", async () => {
      // Sans règle, l'Événement du 1er mars ne rencontre pas la période du
      // 10 au 12 ; c'est l'exception, qui garde son début, qui l'y prolonge.
      const prolonge = await creer(jeu.a, {
        title: 'Chantier',
        startsAt: '2029-03-01T10:00:00.000Z',
        category: 'OTHER',
        scopeId: jeu.a.espacePersonnel,
      });
      await poserDesExceptions(
        app,
        { id: jeu.a.espacePersonnel, kind: 'PERSONAL' },
        [
          {
            eventId: prolonge.id,
            originalStart: '2029-03-01T10:00:00.000Z',
            kind: 'MODIFIED',
            endsAt: '2029-03-15T10:00:00.000Z',
          },
        ],
      );

      expect(
        await occurrencesDe(jeu.a, prolonge, {
          from: '2029-03-10T00:00:00.000Z',
          to: '2029-03-12T00:00:00.000Z',
        }),
      ).toEqual([
        expect.objectContaining({
          startsAt: '2029-03-01T10:00:00.000Z',
          endsAt: '2029-03-15T10:00:00.000Z',
        }),
      ]);
    });

    it('reflète aussitôt un changement de règle', async () => {
      const serie = await creer(jeu.a, {
        title: 'Une semaine sur deux, bientôt',
        startsAt: '2029-03-05T12:00:00.000Z',
        category: 'OTHER',
        recurrence: CHAQUE_LUNDI,
        scopeId: jeu.a.espacePersonnel,
      });
      expect(await occurrencesDe(jeu.a, serie)).toHaveLength(4);

      await request(app.getHttpServer())
        .patch(`/api/events/${serie.id}`)
        .set('Cookie', jeu.a.session)
        .send({ recurrence: { ...CHAQUE_LUNDI, interval: 2 } })
        .expect(200)
        .expect(conformeA(UN_EVENEMENT));

      expect(
        (await occurrencesDe(jeu.a, serie)).map(({ startsAt }) => startsAt),
      ).toEqual(['2029-03-05T12:00:00.000Z', '2029-03-19T12:00:00.000Z']);
    });

    it("retire la règle quand on la nomme vide : l'Événement n'a plus lieu qu'une fois", async () => {
      const serie = await creer(jeu.a, {
        title: 'Plus de série',
        startsAt: '2029-03-06T12:00:00.000Z',
        category: 'OTHER',
        recurrence: CHAQUE_LUNDI,
        scopeId: jeu.a.espacePersonnel,
      });

      const modifie = await request(app.getHttpServer())
        .patch(`/api/events/${serie.id}`)
        .set('Cookie', jeu.a.session)
        .send({ recurrence: null })
        .expect(200);

      expect((modifie.body as Event).recurrence).toBeNull();
      expect(await occurrencesDe(jeu.a, serie)).toEqual([
        expect.objectContaining({ isRecurring: false }),
      ]);
    });

    it.each([
      [
        'un intervalle nul',
        { freq: 'DAILY', interval: 0 },
        'recurrence.interval',
      ],
      [
        'une fin par date et par nombre',
        { freq: 'DAILY', interval: 1, until: '2029-04-01', count: 3 },
        'recurrence.count',
      ],
      [
        'des jours de la semaine sur une règle mensuelle',
        { freq: 'MONTHLY', interval: 1, byWeekday: ['MO'] },
        'recurrence.byWeekday',
      ],
    ])(
      'refuse en 400 %s, à la création comme à la modification',
      async (_cas, recurrence, chemin) => {
        await request(app.getHttpServer())
          .post('/api/events')
          .set('Cookie', jeu.a.session)
          .send({
            title: 'Règle fautive',
            startsAt: '2029-03-05T08:00:00.000Z',
            category: 'OTHER',
            recurrence,
            scopeId: jeu.a.espacePersonnel,
          })
          .expect(400)
          .expect(champsEnErreur([chemin]));

        const cree = await creer(jeu.a, {
          title: 'Règle à fausser',
          startsAt: '2029-03-05T08:00:00.000Z',
          category: 'OTHER',
          scopeId: jeu.a.espacePersonnel,
        });
        await request(app.getHttpServer())
          .patch(`/api/events/${cree.id}`)
          .set('Cookie', jeu.a.session)
          .send({ recurrence })
          .expect(400)
          .expect(champsEnErreur([chemin]));
      },
    );

    it("ne rend jamais une occurrence de la série de l'autre", async () => {
      const sienne = await creer(jeu.b, {
        title: 'Série de B',
        startsAt: '2029-03-05T06:00:00.000Z',
        category: 'OTHER',
        recurrence: CHAQUE_LUNDI,
        scopeId: jeu.b.espacePersonnel,
      });

      expect(await occurrencesDe(jeu.a, sienne)).toEqual([]);
      expect(await occurrencesDe(jeu.b, sienne)).toHaveLength(4);
    });

    it("rend 404 sur la règle de la série de l'autre, et n'y touche pas", async () => {
      const sienne = await creer(jeu.b, {
        title: 'Autre série de B',
        startsAt: '2029-03-05T06:30:00.000Z',
        category: 'OTHER',
        recurrence: CHAQUE_LUNDI,
        scopeId: jeu.b.espacePersonnel,
      });

      await request(app.getHttpServer())
        .patch(`/api/events/${sienne.id}`)
        .set('Cookie', jeu.a.session)
        .send({ recurrence: null })
        .expect(404)
        .expect(codeDErreur('event.not_found'));

      expect(await occurrencesDe(jeu.b, sienne)).toHaveLength(4);
    });

    it("refuse en base une exception rattachée à la série d'un autre Espace", async () => {
      const sienne = await creer(jeu.b, {
        title: 'Série de B, visée',
        startsAt: '2029-03-05T05:00:00.000Z',
        category: 'OTHER',
        recurrence: CHAQUE_LUNDI,
        scopeId: jeu.b.espacePersonnel,
      });

      await expect(
        poserDesExceptions(
          app,
          { id: jeu.a.espacePersonnel, kind: 'PERSONAL' },
          [
            {
              eventId: sienne.id,
              originalStart: '2029-03-12T05:00:00.000Z',
              kind: 'CANCELLED',
            },
          ],
        ),
      ).rejects.toThrow();
      expect(await occurrencesDe(jeu.b, sienne)).toHaveLength(4);
    });

    it("emmène ses exceptions avec la série qui change d'Espace", async () => {
      const serie = await creer(jeu.a, {
        title: 'Bientôt commune',
        startsAt: '2029-03-05T15:00:00.000Z',
        category: 'OTHER',
        recurrence: CHAQUE_LUNDI,
        scopeId: jeu.a.espacePersonnel,
      });
      await poserDesExceptions(
        app,
        { id: jeu.a.espacePersonnel, kind: 'PERSONAL' },
        [
          {
            eventId: serie.id,
            originalStart: '2029-03-12T15:00:00.000Z',
            kind: 'CANCELLED',
          },
        ],
      );

      await request(app.getHttpServer())
        .patch(`/api/events/${serie.id}`)
        .set('Cookie', jeu.a.session)
        .send({ scopeId: jeu.espaceFoyer })
        .expect(200);

      expect(
        (await occurrencesDe(jeu.b, serie)).map(
          ({ originalStart }) => originalStart,
        ),
      ).toEqual([
        '2029-03-05T15:00:00.000Z',
        '2029-03-19T15:00:00.000Z',
        '2029-03-26T14:00:00.000Z',
      ]);
    });

    it('supprime ses exceptions avec la série', async () => {
      const espace = { id: jeu.a.espacePersonnel, kind: 'PERSONAL' } as const;
      const serie = await creer(jeu.a, {
        title: 'À supprimer',
        startsAt: '2029-03-05T14:00:00.000Z',
        category: 'OTHER',
        recurrence: CHAQUE_LUNDI,
        scopeId: espace.id,
      });
      await poserDesExceptions(app, espace, [
        {
          eventId: serie.id,
          originalStart: '2029-03-12T14:00:00.000Z',
          kind: 'CANCELLED',
        },
      ]);
      expect(await compterLesExceptions(app, espace, serie.id)).toBe(1);

      await request(app.getHttpServer())
        .delete(`/api/events/${serie.id}`)
        .set('Cookie', jeu.a.session)
        .expect(204);

      expect(await compterLesExceptions(app, espace, serie.id)).toBe(0);
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

      const relu = (await lister(jeu.a)).find(
        ({ eventId }) => eventId === cree.id,
      );
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

  async function lister(
    compte: JeuDEspaces['a'],
    periode: { from: string; to: string } = TOUT,
  ): Promise<EventOccurrence[]> {
    const reponse = await request(app.getHttpServer())
      .get('/api/events')
      .query(periode)
      .set('Cookie', compte.session)
      .expect(200);

    return reponse.body;
  }
});
