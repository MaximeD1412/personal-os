import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  SOURCE_SPORT,
  zTrainingSession,
  type AgendaItem,
  type TrainingSession,
} from '@personal-os/contracts';
import request from 'supertest';
import { z } from 'zod';
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

/** Une Séance exactement conforme au contrat, sans un champ de plus. */
const UNE_SEANCE = zTrainingSession.strict();

/** Avril 2029 : une fenêtre qu'aucune autre campagne n'occupe. */
const AVRIL = {
  from: '2029-04-01T00:00:00.000Z',
  to: '2029-04-30T23:59:59.999Z',
};

const FOOTING = {
  startsAt: '2029-04-10T05:30:00.000Z',
  sport: 'RUN',
  status: 'PLANNED',
  plannedDistanceM: 10_000,
  plannedDurationS: 3_600,
  plannedIntent: 'Footing',
} as const;

describe('Sport', () => {
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

  describe('POST /training-sessions', () => {
    it("crée une Séance prévue dans l'Espace personnel du Compte, conforme au contrat", async () => {
      const reponse = await request(app.getHttpServer())
        .post('/api/training-sessions')
        .set('Cookie', jeu.a.session)
        .send(FOOTING)
        .expect(201)
        .expect(conformeA(UNE_SEANCE));

      expect(reponse.body).toMatchObject({
        ...FOOTING,
        actualDistanceM: null,
        actualDurationS: null,
        actualNotes: null,
        goalId: null,
        scopeId: jeu.a.espacePersonnel,
      });
    });

    it('crée une sortie non planifiée directement réalisée, sans prévu', async () => {
      const sortie = await creer(jeu.a, {
        startsAt: '2029-04-11T17:00:00.000Z',
        sport: 'BIKE',
        status: 'DONE',
        actualDistanceM: 32_000,
        actualDurationS: 4_500,
        actualNotes: 'Vent de face au retour',
      });

      expect(sortie).toMatchObject({
        status: 'DONE',
        plannedDistanceM: null,
        plannedDurationS: null,
        plannedIntent: null,
        actualDistanceM: 32_000,
      });
    });

    it('refuse en 400 un réalisé sur une Séance prévue, sur son champ', async () => {
      await request(app.getHttpServer())
        .post('/api/training-sessions')
        .set('Cookie', jeu.a.session)
        .send({ ...FOOTING, actualDistanceM: 10_100 })
        .expect(400)
        .expect(champsEnErreur(['actualDistanceM']));
    });

    it('refuse en 400 une Séance créée déjà manquée', async () => {
      await request(app.getHttpServer())
        .post('/api/training-sessions')
        .set('Cookie', jeu.a.session)
        .send({ ...FOOTING, status: 'MISSED' })
        .expect(400)
        .expect(champsEnErreur(['status']));
    });

    it("n'écrit rien sans session", async () => {
      await request(app.getHttpServer())
        .post('/api/training-sessions')
        .send(FOOTING)
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('GET /training-sessions', () => {
    it('rend les Séances de la période, triées, conformes au contrat', async () => {
      const tard = await creer(jeu.a, {
        ...FOOTING,
        startsAt: '2029-04-20T05:30:00.000Z',
      });
      const tot = await creer(jeu.a, {
        ...FOOTING,
        startsAt: '2029-04-02T05:30:00.000Z',
      });
      const horsPeriode = await creer(jeu.a, {
        ...FOOTING,
        startsAt: '2029-05-02T05:30:00.000Z',
      });

      const reponse = await request(app.getHttpServer())
        .get('/api/training-sessions')
        .query(AVRIL)
        .set('Cookie', jeu.a.session)
        .expect(200)
        .expect(conformeA(z.array(UNE_SEANCE)));

      const ids = (reponse.body as TrainingSession[]).map(({ id }) => id);
      expect(ids.indexOf(tot.id)).toBeLessThan(ids.indexOf(tard.id));
      expect(ids).not.toContain(horsPeriode.id);
    });

    it('refuse en 400 une lecture sans période', async () => {
      await request(app.getHttpServer())
        .get('/api/training-sessions')
        .set('Cookie', jeu.a.session)
        .expect(400)
        .expect(champsEnErreur(['from', 'to']));
    });

    it("ne rend jamais une Séance de l'autre Compte", async () => {
      const sienne = await creer(jeu.b, FOOTING);

      expect((await lister(jeu.a)).map(({ id }) => id)).not.toContain(
        sienne.id,
      );
      expect((await lister(jeu.b)).map(({ id }) => id)).toContain(sienne.id);
    });

    it("n'expose rien sans session", async () => {
      await request(app.getHttpServer())
        .get('/api/training-sessions')
        .query(AVRIL)
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('GET /training-sessions/:id', () => {
    it('rend la Séance, conforme au contrat', async () => {
      const seance = await creer(jeu.a, FOOTING);

      await request(app.getHttpServer())
        .get(`/api/training-sessions/${seance.id}`)
        .set('Cookie', jeu.a.session)
        .expect(200)
        .expect(conformeA(UNE_SEANCE))
        .expect(({ body }) => expect(body).toEqual(seance));
    });

    it("rend 404 sur la Séance de l'autre Compte", async () => {
      const sienne = await creer(jeu.b, FOOTING);

      await request(app.getHttpServer())
        .get(`/api/training-sessions/${sienne.id}`)
        .set('Cookie', jeu.a.session)
        .expect(404)
        .expect(codeDErreur('training.not_found'));
    });

    it("n'expose rien sans session", async () => {
      const seance = await creer(jeu.a, FOOTING);

      await request(app.getHttpServer())
        .get(`/api/training-sessions/${seance.id}`)
        .expect(401);
    });
  });

  describe('PATCH /training-sessions/:id', () => {
    it('modifie le prévu, conforme au contrat, et la modification se relit', async () => {
      const seance = await creer(jeu.a, FOOTING);

      await request(app.getHttpServer())
        .patch(`/api/training-sessions/${seance.id}`)
        .set('Cookie', jeu.a.session)
        .send({ plannedDistanceM: 12_000, plannedIntent: null })
        .expect(200)
        .expect(conformeA(UNE_SEANCE));

      expect(await lire(jeu.a, seance.id)).toMatchObject({
        plannedDistanceM: 12_000,
        plannedDurationS: 3_600,
        plannedIntent: null,
      });
    });

    it('ne change jamais le statut, même nommé', async () => {
      const seance = await creer(jeu.a, FOOTING);

      await request(app.getHttpServer())
        .patch(`/api/training-sessions/${seance.id}`)
        .set('Cookie', jeu.a.session)
        .send({ status: 'DONE', plannedDurationS: 3_000 })
        .expect(200);

      expect((await lire(jeu.a, seance.id)).status).toBe('PLANNED');
    });

    it('refuse en 400 une modification hors contrat', async () => {
      const seance = await creer(jeu.a, FOOTING);

      await request(app.getHttpServer())
        .patch(`/api/training-sessions/${seance.id}`)
        .set('Cookie', jeu.a.session)
        .send({ plannedDurationS: -5 })
        .expect(400)
        .expect(champsEnErreur(['plannedDurationS']));
    });

    it.each([
      [{}, 'training.empty_update'],
      [{ actualDistanceM: 9_000 }, 'training.actual_requires_done'],
      [
        { plannedDistanceM: null, plannedDurationS: null, plannedIntent: null },
        'training.planned_required',
      ],
    ])('refuse en 422 %j sur une Séance prévue (%s)', async (saisie, code) => {
      const seance = await creer(jeu.a, FOOTING);

      await request(app.getHttpServer())
        .patch(`/api/training-sessions/${seance.id}`)
        .set('Cookie', jeu.a.session)
        .send(saisie)
        .expect(422)
        .expect(codeDErreur(code));
    });

    it("rend 404 sur la Séance de l'autre Compte, et n'y touche pas", async () => {
      const sienne = await creer(jeu.b, FOOTING);

      await request(app.getHttpServer())
        .patch(`/api/training-sessions/${sienne.id}`)
        .set('Cookie', jeu.a.session)
        .send({ plannedIntent: 'Volée' })
        .expect(404)
        .expect(codeDErreur('training.not_found'));

      expect((await lire(jeu.b, sienne.id)).plannedIntent).toBe('Footing');
    });

    it("n'écrit rien sans session", async () => {
      const seance = await creer(jeu.a, FOOTING);

      await request(app.getHttpServer())
        .patch(`/api/training-sessions/${seance.id}`)
        .send({ plannedIntent: 'Anonyme' })
        .expect(401);
    });
  });

  describe('POST /training-sessions/:id/complete', () => {
    it('marque la Séance réalisée, prévu conservé, réalisé posé', async () => {
      const seance = await creer(jeu.a, FOOTING);

      await request(app.getHttpServer())
        .post(`/api/training-sessions/${seance.id}/complete`)
        .set('Cookie', jeu.a.session)
        .send({ actualDistanceM: 10_400, actualDurationS: 3_480 })
        .expect(200)
        .expect(conformeA(UNE_SEANCE));

      expect(await lire(jeu.a, seance.id)).toMatchObject({
        status: 'DONE',
        plannedDistanceM: 10_000,
        plannedDurationS: 3_600,
        actualDistanceM: 10_400,
        actualDurationS: 3_480,
      });
    });

    it('refuse en 400 une déclaration sans aucune valeur réalisée', async () => {
      const seance = await creer(jeu.a, FOOTING);

      await request(app.getHttpServer())
        .post(`/api/training-sessions/${seance.id}/complete`)
        .set('Cookie', jeu.a.session)
        .send({})
        .expect(400)
        .expect(champsEnErreur(['actualDistanceM']));
    });

    it.each([
      ['complete', 'training.already_done'],
      ['miss', 'training.already_missed'],
    ])(
      'refuse en 422 une Séance déjà passée par %s',
      async (premiere, code) => {
        const seance = await creer(jeu.a, FOOTING);
        await request(app.getHttpServer())
          .post(`/api/training-sessions/${seance.id}/${premiere}`)
          .set('Cookie', jeu.a.session)
          .send({ actualDurationS: 3_000 })
          .expect(200);

        await request(app.getHttpServer())
          .post(`/api/training-sessions/${seance.id}/complete`)
          .set('Cookie', jeu.a.session)
          .send({ actualDurationS: 3_000 })
          .expect(422)
          .expect(codeDErreur(code));
      },
    );

    it("rend 404 sur la Séance de l'autre Compte, et la laisse prévue", async () => {
      const sienne = await creer(jeu.b, FOOTING);

      await request(app.getHttpServer())
        .post(`/api/training-sessions/${sienne.id}/complete`)
        .set('Cookie', jeu.a.session)
        .send({ actualDurationS: 3_000 })
        .expect(404)
        .expect(codeDErreur('training.not_found'));

      expect((await lire(jeu.b, sienne.id)).status).toBe('PLANNED');
    });

    it("n'écrit rien sans session", async () => {
      const seance = await creer(jeu.a, FOOTING);

      await request(app.getHttpServer())
        .post(`/api/training-sessions/${seance.id}/complete`)
        .send({ actualDurationS: 3_000 })
        .expect(401);
    });
  });

  describe('POST /training-sessions/:id/miss', () => {
    it('marque la Séance manquée et garde son prévu, sans réalisé', async () => {
      const seance = await creer(jeu.a, FOOTING);

      await request(app.getHttpServer())
        .post(`/api/training-sessions/${seance.id}/miss`)
        .set('Cookie', jeu.a.session)
        .expect(200)
        .expect(conformeA(UNE_SEANCE));

      expect(await lire(jeu.a, seance.id)).toMatchObject({
        status: 'MISSED',
        plannedDistanceM: 10_000,
        plannedDurationS: 3_600,
        plannedIntent: 'Footing',
        actualDistanceM: null,
        actualDurationS: null,
        actualNotes: null,
      });
    });

    it('refuse en 422 une Séance déjà réalisée', async () => {
      const sortie = await creer(jeu.a, {
        startsAt: '2029-04-12T17:00:00.000Z',
        sport: 'SWIM',
        status: 'DONE',
        actualDistanceM: 1_500,
      });

      await request(app.getHttpServer())
        .post(`/api/training-sessions/${sortie.id}/miss`)
        .set('Cookie', jeu.a.session)
        .expect(422)
        .expect(codeDErreur('training.already_done'));
    });

    it("rend 404 sur la Séance de l'autre Compte", async () => {
      const sienne = await creer(jeu.b, FOOTING);

      await request(app.getHttpServer())
        .post(`/api/training-sessions/${sienne.id}/miss`)
        .set('Cookie', jeu.a.session)
        .expect(404)
        .expect(codeDErreur('training.not_found'));

      expect((await lire(jeu.b, sienne.id)).status).toBe('PLANNED');
    });

    it("n'écrit rien sans session", async () => {
      const seance = await creer(jeu.a, FOOTING);

      await request(app.getHttpServer())
        .post(`/api/training-sessions/${seance.id}/miss`)
        .expect(401);
    });
  });

  describe("Dans l'Agenda", () => {
    it('présente la Séance à son seul propriétaire, avec son statut', async () => {
      const seance = await creer(jeu.a, {
        ...FOOTING,
        startsAt: '2029-04-25T05:30:00.000Z',
      });
      await request(app.getHttpServer())
        .post(`/api/training-sessions/${seance.id}/miss`)
        .set('Cookie', jeu.a.session)
        .expect(200);

      const sienne = (await agenda(jeu.a)).find(
        ({ sourceId }) => sourceId === seance.id,
      );
      expect(sienne).toEqual({
        source: SOURCE_SPORT,
        sourceId: seance.id,
        title: 'Course à pied · Footing',
        startsAt: '2029-04-25T05:30:00.000Z',
        endsAt: '2029-04-25T06:30:00.000Z',
        status: 'MISSED',
      });

      expect((await agenda(jeu.b)).map(({ sourceId }) => sourceId)).not.toContain(
        seance.id,
      );
    });
  });

  async function creer(
    compte: CompteDeTest,
    saisie: Record<string, unknown>,
  ): Promise<TrainingSession> {
    const reponse = await request(app.getHttpServer())
      .post('/api/training-sessions')
      .set('Cookie', compte.session)
      .send(saisie)
      .expect(201);

    return reponse.body;
  }

  async function lire(
    compte: CompteDeTest,
    id: string,
  ): Promise<TrainingSession> {
    const reponse = await request(app.getHttpServer())
      .get(`/api/training-sessions/${id}`)
      .set('Cookie', compte.session)
      .expect(200);

    return reponse.body;
  }

  async function lister(compte: CompteDeTest): Promise<TrainingSession[]> {
    const reponse = await request(app.getHttpServer())
      .get('/api/training-sessions')
      .query(AVRIL)
      .set('Cookie', compte.session)
      .expect(200);

    return reponse.body;
  }

  async function agenda(compte: CompteDeTest): Promise<AgendaItem[]> {
    const reponse = await request(app.getHttpServer())
      .get('/api/agenda')
      .query(AVRIL)
      .set('Cookie', compte.session)
      .expect(200);

    return reponse.body;
  }
});
