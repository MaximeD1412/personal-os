import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  zTrainingGoal,
  zTrainingSession,
  type TrainingGoal,
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

/** Un Objectif, et une Séance, exactement conformes au contrat. */
const UN_OBJECTIF = zTrainingGoal.strict();
const DES_SEANCES = z.array(zTrainingSession.strict());

const SEMI = {
  title: 'Semi-marathon de Lyon',
  date: '2030-06-02',
  intent: 'Sous 1 h 45',
} as const;

/**
 * Mai 2030 : du mercredi 1er au vendredi 31. Les mardis et jeudis donnent
 * neuf Séances, à 7 h 15 à Paris (5 h 15 UTC, heure d'été). Une fenêtre
 * qu'aucune autre campagne n'occupe.
 */
const SERIE_DE_MAI = {
  weekdays: ['TU', 'TH'],
  from: '2030-05-01',
  to: '2030-05-31',
  time: '07:15',
  sport: 'RUN',
  plannedDistanceM: 8_000,
  plannedIntent: 'Footing',
} as const;

const DEBUTS_DE_MAI = [
  '2030-05-02T05:15:00.000Z',
  '2030-05-07T05:15:00.000Z',
  '2030-05-09T05:15:00.000Z',
  '2030-05-14T05:15:00.000Z',
  '2030-05-16T05:15:00.000Z',
  '2030-05-21T05:15:00.000Z',
  '2030-05-23T05:15:00.000Z',
  '2030-05-28T05:15:00.000Z',
  '2030-05-30T05:15:00.000Z',
];

describe('Sport : Objectifs', () => {
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

  describe('POST /training-goals', () => {
    it("crée un Objectif dans l'Espace personnel du Compte, conforme au contrat", async () => {
      const reponse = await request(app.getHttpServer())
        .post('/api/training-goals')
        .set('Cookie', jeu.a.session)
        .send(SEMI)
        .expect(201)
        .expect(conformeA(UN_OBJECTIF));

      expect(reponse.body).toMatchObject({
        ...SEMI,
        progress: { done: 0, missed: 0, planned: 0 },
        scopeId: jeu.a.espacePersonnel,
      });
    });

    it('crée un Objectif sans intention', async () => {
      const { intent: _, ...sansIntention } = SEMI;

      expect(await creerObjectif(jeu.a, sansIntention)).toMatchObject({
        intent: null,
      });
    });

    it('refuse en 400 un Objectif sans titre ni jour valable, sur ses champs', async () => {
      await request(app.getHttpServer())
        .post('/api/training-goals')
        .set('Cookie', jeu.a.session)
        .send({ title: '  ', date: '02/06/2030' })
        .expect(400)
        .expect(champsEnErreur(['title', 'date']));
    });

    it("n'écrit rien sans session", async () => {
      await request(app.getHttpServer())
        .post('/api/training-goals')
        .send(SEMI)
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('GET /training-goals', () => {
    it('rend les Objectifs du Compte, du plus proche au plus lointain, conformes au contrat', async () => {
      const loin = await creerObjectif(jeu.a, { ...SEMI, date: '2031-04-06' });
      const proche = await creerObjectif(jeu.a, {
        ...SEMI,
        date: '2030-03-10',
      });

      const reponse = await request(app.getHttpServer())
        .get('/api/training-goals')
        .set('Cookie', jeu.a.session)
        .expect(200)
        .expect(conformeA(z.array(UN_OBJECTIF)));

      const ids = (reponse.body as TrainingGoal[]).map(({ id }) => id);
      expect(ids.indexOf(proche.id)).toBeLessThan(ids.indexOf(loin.id));
    });

    it("compte l'avancement de chaque Objectif : faites, manquées, à venir", async () => {
      const objectif = await creerObjectif(jeu.a, SEMI);
      const [premiere, deuxieme] = (
        await creerLaSerie(jeu.a, objectif.id, SERIE_DE_MAI).expect(201)
      ).body as TrainingSession[];
      await request(app.getHttpServer())
        .post(`/api/training-sessions/${premiere?.id}/complete`)
        .set('Cookie', jeu.a.session)
        .send({ actualDistanceM: 8_200 })
        .expect(200);
      await request(app.getHttpServer())
        .post(`/api/training-sessions/${deuxieme?.id}/miss`)
        .set('Cookie', jeu.a.session)
        .expect(200);

      const lu = (await listerObjectifs(jeu.a)).find(
        ({ id }) => id === objectif.id,
      );
      expect(lu?.progress).toEqual({ done: 1, missed: 1, planned: 7 });
    });

    it("ne rend jamais un Objectif de l'autre Compte", async () => {
      const sien = await creerObjectif(jeu.b, SEMI);

      expect((await listerObjectifs(jeu.a)).map(({ id }) => id)).not.toContain(
        sien.id,
      );
      expect((await listerObjectifs(jeu.b)).map(({ id }) => id)).toContain(
        sien.id,
      );
    });

    it("n'expose rien sans session", async () => {
      await request(app.getHttpServer())
        .get('/api/training-goals')
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('GET /training-goals/:id', () => {
    it("rend l'Objectif, conforme au contrat", async () => {
      const objectif = await creerObjectif(jeu.a, SEMI);

      await request(app.getHttpServer())
        .get(`/api/training-goals/${objectif.id}`)
        .set('Cookie', jeu.a.session)
        .expect(200)
        .expect(conformeA(UN_OBJECTIF))
        .expect(({ body }) => expect(body).toEqual(objectif));
    });

    it("rend 404 sur l'Objectif de l'autre Compte", async () => {
      const sien = await creerObjectif(jeu.b, SEMI);

      await request(app.getHttpServer())
        .get(`/api/training-goals/${sien.id}`)
        .set('Cookie', jeu.a.session)
        .expect(404)
        .expect(codeDErreur('training.goal_not_found'));
    });

    it("n'expose rien sans session", async () => {
      const objectif = await creerObjectif(jeu.a, SEMI);

      await request(app.getHttpServer())
        .get(`/api/training-goals/${objectif.id}`)
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('PATCH /training-goals/:id', () => {
    it("modifie le titre et le jour, retire l'intention, et la modification se relit", async () => {
      const objectif = await creerObjectif(jeu.a, SEMI);

      const reponse = await modifierObjectif(jeu.a, objectif.id, {
        title: 'Marathon de Paris',
        date: '2030-04-07',
        intent: null,
      })
        .expect(200)
        .expect(conformeA(UN_OBJECTIF));

      expect(reponse.body).toMatchObject({
        title: 'Marathon de Paris',
        date: '2030-04-07',
        intent: null,
      });
      expect(await lireObjectif(jeu.a, objectif.id)).toEqual(reponse.body);
    });

    it('refuse en 400 un titre vide, sur son champ', async () => {
      const objectif = await creerObjectif(jeu.a, SEMI);

      await modifierObjectif(jeu.a, objectif.id, { title: '' })
        .expect(400)
        .expect(champsEnErreur(['title']));
    });

    it('refuse en 422 une modification qui ne change rien', async () => {
      const objectif = await creerObjectif(jeu.a, SEMI);

      await modifierObjectif(jeu.a, objectif.id, {})
        .expect(422)
        .expect(codeDErreur('training.empty_update'));
    });

    it("rend 404 sur l'Objectif de l'autre Compte, et n'y touche pas", async () => {
      const sien = await creerObjectif(jeu.b, SEMI);

      await modifierObjectif(jeu.a, sien.id, { title: 'Détourné' })
        .expect(404)
        .expect(codeDErreur('training.goal_not_found'));
      expect(await lireObjectif(jeu.b, sien.id)).toEqual(sien);
    });

    it("n'écrit rien sans session", async () => {
      const objectif = await creerObjectif(jeu.a, SEMI);

      await request(app.getHttpServer())
        .patch(`/api/training-goals/${objectif.id}`)
        .send({ title: 'Anonyme' })
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('DELETE /training-goals/:id', () => {
    it("supprime l'Objectif ; ses Séances restent, sans lien", async () => {
      const objectif = await creerObjectif(jeu.a, SEMI);
      const seances = (await creerLaSerie(jeu.a, objectif.id, SERIE_DE_MAI))
        .body as TrainingSession[];

      await supprimerObjectif(jeu.a, objectif.id).expect(204);

      await request(app.getHttpServer())
        .get(`/api/training-goals/${objectif.id}`)
        .set('Cookie', jeu.a.session)
        .expect(404);
      for (const seance of seances) {
        const reponse = await request(app.getHttpServer())
          .get(`/api/training-sessions/${seance.id}`)
          .set('Cookie', jeu.a.session)
          .expect(200);
        expect(reponse.body).toEqual({ ...seance, goalId: null });
      }
    });

    it("rend 404 sur l'Objectif de l'autre Compte, et le laisse", async () => {
      const sien = await creerObjectif(jeu.b, SEMI);

      await supprimerObjectif(jeu.a, sien.id)
        .expect(404)
        .expect(codeDErreur('training.goal_not_found'));
      expect(await lireObjectif(jeu.b, sien.id)).toEqual(sien);
    });

    it('ne supprime rien sans session', async () => {
      const objectif = await creerObjectif(jeu.a, SEMI);

      await request(app.getHttpServer())
        .delete(`/api/training-goals/${objectif.id}`)
        .expect(401)
        .expect(codeDErreur('auth.required'));
      expect(await lireObjectif(jeu.a, objectif.id)).toEqual(objectif);
    });
  });

  describe('POST /training-goals/:id/sessions', () => {
    it("crée une Séance prévue par jour choisi de la période, chacune liée à l'Objectif", async () => {
      const objectif = await creerObjectif(jeu.a, SEMI);

      const reponse = await creerLaSerie(jeu.a, objectif.id, SERIE_DE_MAI)
        .expect(201)
        .expect(conformeA(DES_SEANCES));

      const seances = reponse.body as TrainingSession[];
      expect(seances.map(({ startsAt }) => startsAt)).toEqual(DEBUTS_DE_MAI);
      for (const seance of seances) {
        expect(seance).toMatchObject({
          sport: 'RUN',
          status: 'PLANNED',
          plannedDistanceM: 8_000,
          plannedDurationS: null,
          plannedIntent: 'Footing',
          actualDistanceM: null,
          actualDurationS: null,
          actualNotes: null,
          goalId: objectif.id,
          scopeId: jeu.a.espacePersonnel,
        });
      }
      expect(new Set(seances.map(({ id }) => id)).size).toBe(9);
    });

    it('rend des Séances indépendantes, qui se lisent et se modifient une à une', async () => {
      const objectif = await creerObjectif(jeu.a, SEMI);
      const [premiere, deuxieme] = (
        await creerLaSerie(jeu.a, objectif.id, SERIE_DE_MAI).expect(201)
      ).body as TrainingSession[];

      await request(app.getHttpServer())
        .patch(`/api/training-sessions/${premiere?.id}`)
        .set('Cookie', jeu.a.session)
        .send({ plannedIntent: 'Fractionné' })
        .expect(200);

      const liees = await seancesDe(jeu.a, objectif.id);
      expect(liees.find(({ id }) => id === premiere?.id)?.plannedIntent).toBe(
        'Fractionné',
      );
      expect(liees.find(({ id }) => id === deuxieme?.id)?.plannedIntent).toBe(
        'Footing',
      );
    });

    it('refuse en 400 une série sans jour, sur les jours', async () => {
      const objectif = await creerObjectif(jeu.a, SEMI);

      await creerLaSerie(jeu.a, objectif.id, { ...SERIE_DE_MAI, weekdays: [] })
        .expect(400)
        .expect(champsEnErreur(['weekdays']));
    });

    it('refuse en 400 une fin qui précède le début, sur la fin', async () => {
      const objectif = await creerObjectif(jeu.a, SEMI);

      await creerLaSerie(jeu.a, objectif.id, {
        ...SERIE_DE_MAI,
        to: '2030-04-30',
      })
        .expect(400)
        .expect(champsEnErreur(['to']));
    });

    it('refuse en 422 une série qui ne tombe sur aucun jour, et ne crée rien', async () => {
      const objectif = await creerObjectif(jeu.a, SEMI);

      await creerLaSerie(jeu.a, objectif.id, {
        ...SERIE_DE_MAI,
        weekdays: ['MO'],
        to: '2030-05-05',
      })
        .expect(422)
        .expect(codeDErreur('training.series_empty'));
      expect(await seancesDe(jeu.a, objectif.id)).toEqual([]);
    });

    it("refuse en 422 une heure qui n'existe pas au passage à l'heure d'été, et ne crée rien", async () => {
      const objectif = await creerObjectif(jeu.a, SEMI);

      await creerLaSerie(jeu.a, objectif.id, {
        ...SERIE_DE_MAI,
        weekdays: ['SU'],
        from: '2030-03-24',
        to: '2030-04-07',
        time: '02:30',
      })
        .expect(422)
        .expect(codeDErreur('training.series_nonexistent_time'));
      expect(await seancesDe(jeu.a, objectif.id)).toEqual([]);
    });

    it('refuse en 422 une série de plus de cent Séances, et ne crée rien', async () => {
      const objectif = await creerObjectif(jeu.a, SEMI);

      await creerLaSerie(jeu.a, objectif.id, {
        ...SERIE_DE_MAI,
        weekdays: ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'],
        from: '2030-01-01',
        to: '2030-04-11',
      })
        .expect(422)
        .expect(codeDErreur('training.series_too_long'));
      expect(await seancesDe(jeu.a, objectif.id)).toEqual([]);
    });

    it("rend 404 sur l'Objectif de l'autre Compte, et ne crée rien", async () => {
      const sien = await creerObjectif(jeu.b, SEMI);

      await creerLaSerie(jeu.a, sien.id, SERIE_DE_MAI)
        .expect(404)
        .expect(codeDErreur('training.goal_not_found'));
      expect(await seancesDe(jeu.b, sien.id)).toEqual([]);
    });

    it("n'écrit rien sans session", async () => {
      const objectif = await creerObjectif(jeu.a, SEMI);

      await request(app.getHttpServer())
        .post(`/api/training-goals/${objectif.id}/sessions`)
        .send(SERIE_DE_MAI)
        .expect(401)
        .expect(codeDErreur('auth.required'));
      expect(await seancesDe(jeu.a, objectif.id)).toEqual([]);
    });
  });

  describe('GET /training-goals/:id/sessions', () => {
    it("rend les seules Séances liées à l'Objectif, triées, conformes au contrat", async () => {
      const objectif = await creerObjectif(jeu.a, SEMI);
      const autre = await creerObjectif(jeu.a, SEMI);
      await creerLaSerie(jeu.a, objectif.id, SERIE_DE_MAI).expect(201);
      await creerLaSerie(jeu.a, autre.id, SERIE_DE_MAI).expect(201);

      const reponse = await request(app.getHttpServer())
        .get(`/api/training-goals/${objectif.id}/sessions`)
        .set('Cookie', jeu.a.session)
        .expect(200)
        .expect(conformeA(DES_SEANCES));

      const seances = reponse.body as TrainingSession[];
      expect(seances.map(({ startsAt }) => startsAt)).toEqual(DEBUTS_DE_MAI);
      expect(seances.every(({ goalId }) => goalId === objectif.id)).toBe(true);
    });

    it("rend 404 sur l'Objectif de l'autre Compte", async () => {
      const sien = await creerObjectif(jeu.b, SEMI);
      await creerLaSerie(jeu.b, sien.id, SERIE_DE_MAI).expect(201);

      await request(app.getHttpServer())
        .get(`/api/training-goals/${sien.id}/sessions`)
        .set('Cookie', jeu.a.session)
        .expect(404)
        .expect(codeDErreur('training.goal_not_found'));
    });

    it("n'expose rien sans session", async () => {
      const objectif = await creerObjectif(jeu.a, SEMI);

      await request(app.getHttpServer())
        .get(`/api/training-goals/${objectif.id}/sessions`)
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  async function creerObjectif(
    compte: CompteDeTest,
    saisie: Record<string, unknown>,
  ): Promise<TrainingGoal> {
    const reponse = await request(app.getHttpServer())
      .post('/api/training-goals')
      .set('Cookie', compte.session)
      .send(saisie)
      .expect(201);

    return reponse.body;
  }

  async function lireObjectif(
    compte: CompteDeTest,
    id: string,
  ): Promise<TrainingGoal> {
    const reponse = await request(app.getHttpServer())
      .get(`/api/training-goals/${id}`)
      .set('Cookie', compte.session)
      .expect(200);

    return reponse.body;
  }

  async function listerObjectifs(
    compte: CompteDeTest,
  ): Promise<TrainingGoal[]> {
    const reponse = await request(app.getHttpServer())
      .get('/api/training-goals')
      .set('Cookie', compte.session)
      .expect(200);

    return reponse.body;
  }

  function modifierObjectif(
    compte: CompteDeTest,
    id: string,
    changements: Record<string, unknown>,
  ) {
    return request(app.getHttpServer())
      .patch(`/api/training-goals/${id}`)
      .set('Cookie', compte.session)
      .send(changements);
  }

  function supprimerObjectif(compte: CompteDeTest, id: string) {
    return request(app.getHttpServer())
      .delete(`/api/training-goals/${id}`)
      .set('Cookie', compte.session);
  }

  function creerLaSerie(
    compte: CompteDeTest,
    id: string,
    serie: Record<string, unknown>,
  ) {
    return request(app.getHttpServer())
      .post(`/api/training-goals/${id}/sessions`)
      .set('Cookie', compte.session)
      .send(serie);
  }

  async function seancesDe(
    compte: CompteDeTest,
    id: string,
  ): Promise<TrainingSession[]> {
    const reponse = await request(app.getHttpServer())
      .get(`/api/training-goals/${id}/sessions`)
      .set('Cookie', compte.session)
      .expect(200);

    return reponse.body;
  }
});
