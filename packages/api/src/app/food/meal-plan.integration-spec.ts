import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  SOURCE_CUISINE,
  zAgendaItem,
  zHousehold,
  zMealPlan,
  zMealPlanEntry,
  type AgendaItem,
  type Ingredient,
  type MealPlan,
  type MealPlanEntry,
  type Recipe,
} from '@personal-os/contracts';
import { PrismaService, sousPortee } from '@personal-os/database';
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
import { MealPlanRepository } from './meal-plan.repository';

const REDIRECT_URI = 'http://app.exemple.test/api/auth/callback';
const DASHBOARD_URL = 'http://app.exemple.test/';
const ADRESSE_A = 'a@exemple.test';
const ADRESSE_B = 'b@exemple.test';

/** Un Repas planifié et un Planning exactement conformes au contrat. */
const UN_REPAS = zMealPlanEntry
  .extend({ recipe: zMealPlanEntry.shape.recipe.unwrap().strict().nullable() })
  .strict();
const UN_PLANNING = zMealPlan.extend({ entries: z.array(UN_REPAS) }).strict();
const UNE_ENTREE_D_AGENDA = zAgendaItem.strict();

const INCONNU = '00000000-0000-4000-8000-000000000000';

/**
 * La Cuisine vit dans l'Espace foyer : un Planning de repas est aux deux
 * Comptes. Il n'y a donc pas de 404 croisé à prouver (ADR 0030) ; on prouve
 * que chacun lit et modifie le planning de l'autre.
 *
 * La campagne partage sa base entre les fichiers : chaque test prend une
 * semaine de 2028 qui n'appartient qu'à lui.
 */
describe('Planning de repas', () => {
  let authentik: FauxAuthentik;
  let app: INestApplication;
  let jeu: JeuDEspaces;
  let prisma: PrismaService;
  let compteA: string;
  let compteB: string;
  let lentilles: Ingredient;

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
    prisma = app.get(PrismaService);

    jeu = await poserLeJeuDEspaces(app, authentik, [ADRESSE_A, ADRESSE_B]);

    const foyer = zHousehold.parse(
      (
        await request(app.getHttpServer())
          .get('/api/household')
          .set('Cookie', jeu.a.session)
          .expect(200)
      ).body,
    );
    [compteA, compteB] = foyer.members.map(({ id }) => id);

    const reponse = await request(app.getHttpServer())
      .post('/api/ingredients')
      .set('Cookie', jeu.a.session)
      .send({
        displayName: 'Lentilles vertes (planning)',
        canonicalUnit: 'GRAM',
      })
      .expect(201);
    lentilles = reponse.body as Ingredient;
  });

  afterAll(async () => {
    await app?.close();
    await authentik?.close();
  });

  describe('GET /meal-plans', () => {
    it("crée le planning vide et ouvert d'une semaine à sa première lecture, puis le relit", async () => {
      const premiere = await request(app.getHttpServer())
        .get('/api/meal-plans?week=2028-05-01')
        .set('Cookie', jeu.a.session)
        .expect(200)
        .expect(conformeA(UN_PLANNING));

      expect(premiere.body).toMatchObject({
        week: '2028-05-01',
        status: 'OPEN',
        entries: [],
      });

      const seconde = await request(app.getHttpServer())
        .get('/api/meal-plans?week=2028-05-01')
        .set('Cookie', jeu.b.session)
        .expect(200);
      expect(seconde.body.id).toBe(premiere.body.id);

      const enBase = await sousPortee(
        {
          espaces: [{ id: jeu.espaceFoyer, kind: 'HOUSEHOLD' }],
          typesAcceptes: ['HOUSEHOLD'],
        },
        async () =>
          await prisma.mealPlan.findUniqueOrThrow({
            where: { id: premiere.body.id },
          }),
      );
      expect(enBase.scopeId).toBe(jeu.espaceFoyer);
    });

    it('donne le même planning à deux premières lectures simultanées', async () => {
      const [une, autre] = await Promise.all([
        request(app.getHttpServer())
          .get('/api/meal-plans?week=2028-05-08')
          .set('Cookie', jeu.a.session)
          .expect(200),
        request(app.getHttpServer())
          .get('/api/meal-plans?week=2028-05-08')
          .set('Cookie', jeu.b.session)
          .expect(200),
      ]);

      expect(une.body.id).toBe(autre.body.id);
    });

    it("refuse une semaine qui n'est pas un lundi, sur `week`", async () => {
      await request(app.getHttpServer())
        .get('/api/meal-plans?week=2028-05-03')
        .set('Cookie', jeu.a.session)
        .expect(400)
        .expect(champsEnErreur(['week']));
    });

    it('refuse une requête sans session', async () => {
      await request(app.getHttpServer())
        .get('/api/meal-plans?week=2028-05-01')
        .expect(401);
    });
  });

  describe('POST /meal-plans/:id/entries', () => {
    it('ajoute un repas approuvé, dont les portions sont ses Participants et ses Invités', async () => {
      const planning = await lire(jeu.a, '2028-05-15');
      const recette = await creerUneRecette('Dahl du planning');

      const reponse = await request(app.getHttpServer())
        .post(`/api/meal-plans/${planning.id}/entries`)
        .set('Cookie', jeu.b.session)
        .send({
          day: '2028-05-17',
          moment: 'DINNER',
          recipeId: recette.id,
          participantIds: [compteA, compteB],
          guestCount: 2,
        })
        .expect(201)
        .expect(conformeA(UN_REPAS));

      expect(reponse.body).toMatchObject({
        day: '2028-05-17',
        moment: 'DINNER',
        recipe: { id: recette.id, title: 'Dahl du planning' },
        title: null,
        guestCount: 2,
        servings: 4,
        decision: 'APPROVED',
      });
      expect([...reponse.body.participantIds].sort()).toEqual(
        [compteA, compteB].sort(),
      );

      const relu = await lire(jeu.a, '2028-05-15');
      expect(relu.entries.map(({ id }) => id)).toEqual([reponse.body.id]);
    });

    it('ajoute un repas par un intitulé libre, sans Invités par défaut', async () => {
      const planning = await lire(jeu.a, '2028-05-15');

      const reponse = await request(app.getHttpServer())
        .post(`/api/meal-plans/${planning.id}/entries`)
        .set('Cookie', jeu.a.session)
        .send({
          day: '2028-05-15',
          moment: 'LUNCH',
          title: 'Restes de la veille',
          participantIds: [compteA],
        })
        .expect(201)
        .expect(conformeA(UN_REPAS));

      expect(reponse.body).toMatchObject({
        recipe: null,
        title: 'Restes de la veille',
        guestCount: 0,
        servings: 1,
      });
    });

    it('refuse un repas sans recette ni intitulé, sur `title`', async () => {
      const planning = await lire(jeu.a, '2028-05-15');

      await request(app.getHttpServer())
        .post(`/api/meal-plans/${planning.id}/entries`)
        .set('Cookie', jeu.a.session)
        .send({ day: '2028-05-15', moment: 'LUNCH', participantIds: [compteA] })
        .expect(400)
        .expect(champsEnErreur(['title']));
    });

    it.each([
      [
        'un jour hors de la semaine',
        { day: '2028-05-22' },
        'food.entry_out_of_week',
      ],
      [
        'aucun Participant',
        { participantIds: [] },
        'food.entry_no_participant',
      ],
      [
        'un Participant hors du Foyer',
        { participantIds: [INCONNU] },
        'food.unknown_participant',
      ],
      [
        'une recette inconnue',
        { title: undefined, recipeId: INCONNU },
        'food.entry_unknown_recipe',
      ],
    ])('refuse %s, en 422', async (_cas, changement, code) => {
      const planning = await lire(jeu.a, '2028-05-15');

      await request(app.getHttpServer())
        .post(`/api/meal-plans/${planning.id}/entries`)
        .set('Cookie', jeu.a.session)
        .send({
          day: '2028-05-16',
          moment: 'LUNCH',
          title: 'Soupe',
          participantIds: [compteA],
          ...changement,
        })
        .expect(422)
        .expect(codeDErreur(code));
    });

    it('répond 404 pour un planning inconnu', async () => {
      await request(app.getHttpServer())
        .post(`/api/meal-plans/${INCONNU}/entries`)
        .set('Cookie', jeu.a.session)
        .send(unRepas('2028-05-16'))
        .expect(404)
        .expect(codeDErreur('food.plan_not_found'));
    });

    it('refuse une requête sans session', async () => {
      await request(app.getHttpServer())
        .post(`/api/meal-plans/${INCONNU}/entries`)
        .send(unRepas('2028-05-16'))
        .expect(401);
    });
  });

  describe('PATCH /meal-plans/:id/entries/:entryId', () => {
    it("modifie un repas, et une recette y remplace l'intitulé", async () => {
      const planning = await lire(jeu.a, '2028-05-29');
      const repas = await ajouter(jeu.a, planning, unRepas('2028-05-29'));
      const recette = await creerUneRecette('Curry du planning');

      const reponse = await request(app.getHttpServer())
        .patch(`/api/meal-plans/${planning.id}/entries/${repas.id}`)
        .set('Cookie', jeu.b.session)
        .send({ recipeId: recette.id, moment: 'DINNER', guestCount: 3 })
        .expect(200)
        .expect(conformeA(UN_REPAS));

      expect(reponse.body).toMatchObject({
        id: repas.id,
        moment: 'DINNER',
        recipe: { id: recette.id, title: 'Curry du planning' },
        title: null,
        guestCount: 3,
        servings: 4,
      });

      const intitule = await request(app.getHttpServer())
        .patch(`/api/meal-plans/${planning.id}/entries/${repas.id}`)
        .set('Cookie', jeu.a.session)
        .send({ title: 'Restaurant' })
        .expect(200);
      expect(intitule.body).toMatchObject({
        recipe: null,
        title: 'Restaurant',
      });
    });

    it('refuse une recette et un intitulé à la fois, sur `title`', async () => {
      const planning = await lire(jeu.a, '2028-05-29');
      const repas = await ajouter(jeu.a, planning, unRepas('2028-05-30'));

      await request(app.getHttpServer())
        .patch(`/api/meal-plans/${planning.id}/entries/${repas.id}`)
        .set('Cookie', jeu.a.session)
        .send({ recipeId: INCONNU, title: 'Pâtes' })
        .expect(400)
        .expect(champsEnErreur(['title']));
    });

    it.each([
      ['une modification vide', {}, 'food.entry_empty_update'],
      [
        'un jour hors de la semaine',
        { day: '2028-06-05' },
        'food.entry_out_of_week',
      ],
      [
        'aucun Participant',
        { participantIds: [] },
        'food.entry_no_participant',
      ],
      [
        'un Participant hors du Foyer',
        { participantIds: [INCONNU, INCONNU.replace(/0$/, '1')] },
        'food.unknown_participant',
      ],
      [
        'une recette inconnue',
        { recipeId: INCONNU },
        'food.entry_unknown_recipe',
      ],
    ])('refuse %s, en 422', async (_cas, changement, code) => {
      const planning = await lire(jeu.a, '2028-05-29');
      const repas = await ajouter(jeu.a, planning, unRepas('2028-05-31'));

      await request(app.getHttpServer())
        .patch(`/api/meal-plans/${planning.id}/entries/${repas.id}`)
        .set('Cookie', jeu.a.session)
        .send(changement)
        .expect(422)
        .expect(codeDErreur(code));
    });

    it("répond 404 pour un repas inconnu, ou d'un autre planning", async () => {
      const planning = await lire(jeu.a, '2028-05-29');
      const autre = await lire(jeu.a, '2028-06-05');
      const repas = await ajouter(jeu.a, autre, unRepas('2028-06-05'));

      for (const id of [INCONNU, repas.id]) {
        await request(app.getHttpServer())
          .patch(`/api/meal-plans/${planning.id}/entries/${id}`)
          .set('Cookie', jeu.a.session)
          .send({ guestCount: 1 })
          .expect(404)
          .expect(codeDErreur('food.entry_not_found'));
      }
    });

    it('refuse une requête sans session', async () => {
      await request(app.getHttpServer())
        .patch(`/api/meal-plans/${INCONNU}/entries/${INCONNU}`)
        .send({ guestCount: 1 })
        .expect(401);
    });
  });

  describe('DELETE /meal-plans/:id/entries/:entryId', () => {
    it('retire un repas du planning', async () => {
      const planning = await lire(jeu.a, '2028-06-12');
      const repas = await ajouter(jeu.a, planning, unRepas('2028-06-12'));

      await request(app.getHttpServer())
        .delete(`/api/meal-plans/${planning.id}/entries/${repas.id}`)
        .set('Cookie', jeu.b.session)
        .expect(204);

      expect((await lire(jeu.a, '2028-06-12')).entries).toEqual([]);
    });

    it('répond 404 pour un repas inconnu', async () => {
      const planning = await lire(jeu.a, '2028-06-12');

      await request(app.getHttpServer())
        .delete(`/api/meal-plans/${planning.id}/entries/${INCONNU}`)
        .set('Cookie', jeu.a.session)
        .expect(404)
        .expect(codeDErreur('food.entry_not_found'));
    });

    it('refuse une requête sans session', async () => {
      await request(app.getHttpServer())
        .delete(`/api/meal-plans/${INCONNU}/entries/${INCONNU}`)
        .expect(401);
    });
  });

  describe('POST /meal-plans/:id/stop et /reopen', () => {
    it('arrête un planning, qui refuse alors toute modification de ses repas, puis le rouvre', async () => {
      const planning = await lire(jeu.a, '2028-06-19');
      const repas = await ajouter(jeu.a, planning, unRepas('2028-06-19'));

      const arrete = await request(app.getHttpServer())
        .post(`/api/meal-plans/${planning.id}/stop`)
        .set('Cookie', jeu.a.session)
        .expect(200)
        .expect(conformeA(UN_PLANNING));
      expect(arrete.body.status).toBe('STOPPED');

      const base = `/api/meal-plans/${planning.id}/entries`;
      const serveur = app.getHttpServer();
      for (const essai of [
        () =>
          request(serveur)
            .post(base)
            .set('Cookie', jeu.b.session)
            .send(unRepas('2028-06-20')),
        () =>
          request(serveur)
            .patch(`${base}/${repas.id}`)
            .set('Cookie', jeu.b.session)
            .send({ guestCount: 1 }),
        () =>
          request(serveur)
            .delete(`${base}/${repas.id}`)
            .set('Cookie', jeu.b.session),
      ]) {
        await essai().expect(422).expect(codeDErreur('food.plan_stopped'));
      }

      await request(app.getHttpServer())
        .post(`/api/meal-plans/${planning.id}/stop`)
        .set('Cookie', jeu.a.session)
        .expect(422)
        .expect(codeDErreur('food.plan_already_stopped'));

      const rouvert = await request(app.getHttpServer())
        .post(`/api/meal-plans/${planning.id}/reopen`)
        .set('Cookie', jeu.b.session)
        .expect(200)
        .expect(conformeA(UN_PLANNING));
      expect(rouvert.body).toMatchObject({
        status: 'OPEN',
        entries: [{ id: repas.id }],
      });

      await request(app.getHttpServer())
        .post(`/api/meal-plans/${planning.id}/reopen`)
        .set('Cookie', jeu.b.session)
        .expect(422)
        .expect(codeDErreur('food.plan_already_open'));
    });

    it("refuse d'arrêter un planning dont un repas est encore proposé", async () => {
      const planning = await lire(jeu.a, '2028-06-26');
      const repas = await ajouter(jeu.a, planning, unRepas('2028-06-26'));
      // La génération seule propose (CUISINE-15) : on pose la décision en base.
      await dansLeFoyer(
        async () =>
          await prisma.mealPlanEntry.update({
            where: { id: repas.id },
            data: { decision: 'PROPOSED' },
          }),
      );

      await request(app.getHttpServer())
        .post(`/api/meal-plans/${planning.id}/stop`)
        .set('Cookie', jeu.a.session)
        .expect(422)
        .expect(codeDErreur('food.plan_has_pending'));

      expect((await lire(jeu.a, '2028-06-26')).status).toBe('OPEN');
    });

    it('répond 404 pour un planning inconnu', async () => {
      for (const action of ['stop', 'reopen']) {
        await request(app.getHttpServer())
          .post(`/api/meal-plans/${INCONNU}/${action}`)
          .set('Cookie', jeu.a.session)
          .expect(404)
          .expect(codeDErreur('food.plan_not_found'));
      }
    });

    it('refuse une requête sans session', async () => {
      for (const action of ['stop', 'reopen']) {
        await request(app.getHttpServer())
          .post(`/api/meal-plans/${INCONNU}/${action}`)
          .expect(401);
      }
    });
  });

  describe('POST /meal-plans/:id/entries/:entryId/decision', () => {
    it('approuve un repas proposé, et en refuse un autre, qui reste au planning', async () => {
      const planning = await lire(jeu.a, '2028-09-04');
      const approuve = await proposer(planning, '2028-09-04');
      const refuse = await proposer(planning, '2028-09-05');

      const reponse = await request(app.getHttpServer())
        .post(`/api/meal-plans/${planning.id}/entries/${approuve.id}/decision`)
        .set('Cookie', jeu.a.session)
        .send({ decision: 'APPROVED' })
        .expect(200)
        .expect(conformeA(UN_REPAS));
      expect(reponse.body).toMatchObject({
        id: approuve.id,
        decision: 'APPROVED',
      });

      await request(app.getHttpServer())
        .post(`/api/meal-plans/${planning.id}/entries/${refuse.id}/decision`)
        .set('Cookie', jeu.b.session)
        .send({ decision: 'REFUSED' })
        .expect(200);

      expect((await lire(jeu.b, '2028-09-04')).entries).toMatchObject([
        { id: approuve.id, decision: 'APPROVED' },
        { id: refuse.id, decision: 'REFUSED' },
      ]);
    });

    it('refuse une décision qui n’est ni une approbation ni un refus, sur `decision`', async () => {
      const planning = await lire(jeu.a, '2028-09-11');
      const repas = await proposer(planning, '2028-09-11');

      for (const decision of ['PROPOSED', undefined]) {
        await request(app.getHttpServer())
          .post(`/api/meal-plans/${planning.id}/entries/${repas.id}/decision`)
          .set('Cookie', jeu.a.session)
          .send({ decision })
          .expect(400)
          .expect(champsEnErreur(['decision']));
      }
    });

    it('refuse de décider d’un repas qui n’est pas proposé', async () => {
      const planning = await lire(jeu.a, '2028-09-18');
      const saisi = await ajouter(jeu.a, planning, unRepas('2028-09-18'));
      const statue = await proposer(planning, '2028-09-19');
      await decider(planning, statue, 'REFUSED');

      for (const [repas, decision] of [
        [saisi, 'REFUSED'],
        [statue, 'APPROVED'],
      ] as const) {
        await request(app.getHttpServer())
          .post(`/api/meal-plans/${planning.id}/entries/${repas.id}/decision`)
          .set('Cookie', jeu.a.session)
          .send({ decision })
          .expect(422)
          .expect(codeDErreur('food.entry_not_proposed'));
      }

      expect((await lire(jeu.a, '2028-09-18')).entries).toMatchObject([
        { id: saisi.id, decision: 'APPROVED' },
        { id: statue.id, decision: 'REFUSED' },
      ]);
    });

    it('refuse une décision sur un planning arrêté', async () => {
      const planning = await lire(jeu.a, '2028-09-25');
      const repas = await ajouter(jeu.a, planning, unRepas('2028-09-25'));
      await request(app.getHttpServer())
        .post(`/api/meal-plans/${planning.id}/stop`)
        .set('Cookie', jeu.a.session)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/api/meal-plans/${planning.id}/entries/${repas.id}/decision`)
        .set('Cookie', jeu.a.session)
        .send({ decision: 'REFUSED' })
        .expect(422)
        .expect(codeDErreur('food.plan_stopped'));
    });

    it('répond 404 pour un planning ou un repas inconnu', async () => {
      const planning = await lire(jeu.a, '2028-10-09');

      await request(app.getHttpServer())
        .post(`/api/meal-plans/${INCONNU}/entries/${INCONNU}/decision`)
        .set('Cookie', jeu.a.session)
        .send({ decision: 'APPROVED' })
        .expect(404)
        .expect(codeDErreur('food.plan_not_found'));

      await request(app.getHttpServer())
        .post(`/api/meal-plans/${planning.id}/entries/${INCONNU}/decision`)
        .set('Cookie', jeu.a.session)
        .send({ decision: 'APPROVED' })
        .expect(404)
        .expect(codeDErreur('food.entry_not_found'));
    });

    it('refuse une requête sans session', async () => {
      await request(app.getHttpServer())
        .post(`/api/meal-plans/${INCONNU}/entries/${INCONNU}/decision`)
        .send({ decision: 'APPROVED' })
        .expect(401);
    });
  });

  describe('un Tour de génération statué puis arrêté', () => {
    it('arrête le planning quand chaque repas est approuvé ou refusé, et retire les refusés', async () => {
      const planning = await lire(jeu.a, '2028-10-02');
      const saisi = await ajouter(jeu.a, planning, unRepas('2028-10-02'));
      const approuve = await proposer(planning, '2028-10-03');
      const refuse = await proposer(planning, '2028-10-04');
      await decider(planning, approuve, 'APPROVED');

      await request(app.getHttpServer())
        .post(`/api/meal-plans/${planning.id}/stop`)
        .set('Cookie', jeu.a.session)
        .expect(422)
        .expect(codeDErreur('food.plan_has_pending'));

      await decider(planning, refuse, 'REFUSED');

      const arrete = await request(app.getHttpServer())
        .post(`/api/meal-plans/${planning.id}/stop`)
        .set('Cookie', jeu.b.session)
        .expect(200)
        .expect(conformeA(UN_PLANNING));
      expect(arrete.body).toMatchObject({
        status: 'STOPPED',
        entries: [
          { id: saisi.id, decision: 'APPROVED' },
          { id: approuve.id, decision: 'APPROVED' },
        ],
      });
      expect(arrete.body.entries).toHaveLength(2);
      expect(
        await dansLeFoyer(
          async () =>
            await prisma.mealPlanEntry.count({ where: { id: refuse.id } }),
        ),
      ).toBe(0);
    });
  });

  describe('une recette supprimée entre la vérification et l’écriture', () => {
    /**
     * L'autre Compte supprime la recette juste après que le service l'a
     * trouvée : l'écriture bute alors sur la clé étrangère.
     */
    async function supprimerApresLaVerification(recette: Recipe) {
      const repository = app.get(MealPlanRepository);
      const verifier = repository.recetteExiste.bind(repository);
      return jest
        .spyOn(repository, 'recetteExiste')
        .mockImplementationOnce(async (id) => {
          const existe = await verifier(id);
          await request(app.getHttpServer())
            .delete(`/api/recipes/${recette.id}`)
            .set('Cookie', jeu.b.session)
            .expect(204);
          return existe;
        });
    }

    it('refuse l’ajout en 422, comme une recette inconnue', async () => {
      const planning = await lire(jeu.a, '2028-08-07');
      const recette = await creerUneRecette('Recette supprimée (ajout)');
      const espion = await supprimerApresLaVerification(recette);

      await request(app.getHttpServer())
        .post(`/api/meal-plans/${planning.id}/entries`)
        .set('Cookie', jeu.a.session)
        .send({
          day: '2028-08-08',
          moment: 'DINNER',
          recipeId: recette.id,
          participantIds: [compteA],
        })
        .expect(422)
        .expect(codeDErreur('food.entry_unknown_recipe'));

      espion.mockRestore();
      expect((await lire(jeu.a, '2028-08-07')).entries).toEqual([]);
    });

    it('refuse la modification en 422, et laisse le repas tel quel', async () => {
      const planning = await lire(jeu.a, '2028-08-14');
      const repas = await ajouter(jeu.a, planning, unRepas('2028-08-15'));
      const recette = await creerUneRecette('Recette supprimée (modification)');
      const espion = await supprimerApresLaVerification(recette);

      await request(app.getHttpServer())
        .patch(`/api/meal-plans/${planning.id}/entries/${repas.id}`)
        .set('Cookie', jeu.a.session)
        .send({ recipeId: recette.id })
        .expect(422)
        .expect(codeDErreur('food.entry_unknown_recipe'));

      espion.mockRestore();
      const [relu] = (await lire(jeu.a, '2028-08-14')).entries;
      expect(relu).toMatchObject({ title: 'Soupe', recipe: null });
    });
  });

  describe("dans l'Agenda", () => {
    it('présente les repas approuvés, le déjeuner à midi et le dîner à 19 h 30, heure de Paris', async () => {
      const planning = await lire(jeu.a, '2028-07-03');
      const recette = await creerUneRecette('Ratatouille du planning');
      const dejeuner = await ajouter(jeu.a, planning, {
        ...unRepas('2028-07-04'),
        moment: 'LUNCH',
        title: 'Salade composée',
      });
      const diner = await ajouter(jeu.a, planning, {
        ...unRepas('2028-07-04'),
        moment: 'DINNER',
        title: undefined,
        recipeId: recette.id,
      });
      const propose = await ajouter(jeu.a, planning, unRepas('2028-07-05'));
      await dansLeFoyer(
        async () =>
          await prisma.mealPlanEntry.update({
            where: { id: propose.id },
            data: { decision: 'PROPOSED' },
          }),
      );

      const reponse = await request(app.getHttpServer())
        .get('/api/agenda')
        .query({
          from: '2028-07-03T00:00:00.000Z',
          to: '2028-07-09T23:59:59.999Z',
        })
        .set('Cookie', jeu.b.session)
        .expect(200)
        .expect(conformeA(z.array(UNE_ENTREE_D_AGENDA)));

      const repas = (reponse.body as AgendaItem[]).filter(
        ({ source }) => source === SOURCE_CUISINE,
      );
      expect(repas).toEqual([
        {
          source: SOURCE_CUISINE,
          sourceId: dejeuner.id,
          title: 'Salade composée',
          startsAt: '2028-07-04T10:00:00.000Z',
          endsAt: null,
          status: 'PLANNED',
        },
        {
          source: SOURCE_CUISINE,
          sourceId: diner.id,
          title: 'Ratatouille du planning',
          startsAt: '2028-07-04T17:30:00.000Z',
          endsAt: null,
          status: 'PLANNED',
        },
      ]);
    });

    it("ne présente pas un repas dont l'heure sort de la période", async () => {
      const planning = await lire(jeu.a, '2028-07-10');
      await ajouter(jeu.a, planning, {
        ...unRepas('2028-07-10'),
        moment: 'DINNER',
        title: 'Dîner hors période',
      });

      const reponse = await request(app.getHttpServer())
        .get('/api/agenda')
        .query({
          from: '2028-07-10T00:00:00.000Z',
          to: '2028-07-10T12:00:00.000Z',
        })
        .set('Cookie', jeu.a.session)
        .expect(200);

      expect(
        (reponse.body as AgendaItem[]).filter(
          ({ source }) => source === SOURCE_CUISINE,
        ),
      ).toEqual([]);
    });
  });

  describe('DELETE /recipes/:id', () => {
    it('refuse de supprimer une recette qu’un repas à venir cuisine', async () => {
      const planning = await lire(jeu.a, '2028-07-17');
      const recette = await creerUneRecette('Gratin du planning');
      await ajouter(jeu.a, planning, {
        ...unRepas('2028-07-17'),
        title: undefined,
        recipeId: recette.id,
      });

      await request(app.getHttpServer())
        .delete(`/api/recipes/${recette.id}`)
        .set('Cookie', jeu.a.session)
        .expect(422)
        .expect(codeDErreur('food.recipe_in_use'));

      await request(app.getHttpServer())
        .get(`/api/recipes/${recette.id}`)
        .set('Cookie', jeu.a.session)
        .expect(200);
    });

    it('supprime une recette qu’un repas passé cuisinait, en lui laissant son titre', async () => {
      const planning = await lire(jeu.a, '2020-01-06');
      const recette = await creerUneRecette('Pot-au-feu du planning');
      const repas = await ajouter(jeu.a, planning, {
        ...unRepas('2020-01-07'),
        title: undefined,
        recipeId: recette.id,
      });

      await request(app.getHttpServer())
        .delete(`/api/recipes/${recette.id}`)
        .set('Cookie', jeu.a.session)
        .expect(204);

      const relu = await lire(jeu.a, '2020-01-06');
      expect(relu.entries.find(({ id }) => id === repas.id)).toMatchObject({
        recipe: null,
        title: 'Pot-au-feu du planning',
      });
    });
  });

  function unRepas(day: string) {
    return {
      day,
      moment: 'LUNCH',
      title: 'Soupe',
      participantIds: [compteA],
    } as Record<string, unknown>;
  }

  async function lire(compte: CompteDeTest, week: string): Promise<MealPlan> {
    const reponse = await request(app.getHttpServer())
      .get('/api/meal-plans')
      .query({ week })
      .set('Cookie', compte.session)
      .expect(200);

    return reponse.body as MealPlan;
  }

  async function ajouter(
    compte: CompteDeTest,
    planning: MealPlan,
    saisie: Record<string, unknown>,
  ): Promise<MealPlanEntry> {
    const reponse = await request(app.getHttpServer())
      .post(`/api/meal-plans/${planning.id}/entries`)
      .set('Cookie', compte.session)
      .send(saisie)
      .expect(201);

    return reponse.body as MealPlanEntry;
  }

  /**
   * Un repas proposé par un Tour de génération. La génération vient avec
   * CUISINE-16 : on pose le tour et la décision en base.
   */
  async function proposer(
    planning: MealPlan,
    day: string,
  ): Promise<MealPlanEntry> {
    const repas = await ajouter(jeu.a, planning, unRepas(day));
    await dansLeFoyer(async () => {
      const tour = await prisma.generationRound.upsert({
        where: { mealPlanId_number: { mealPlanId: planning.id, number: 1 } },
        create: {
          mealPlanId: planning.id,
          number: 1,
          scopeId: jeu.espaceFoyer,
        },
        update: {},
      });
      await prisma.mealPlanEntry.update({
        where: { id: repas.id },
        data: { decision: 'PROPOSED', generationRoundId: tour.id },
      });
    });

    return { ...repas, decision: 'PROPOSED' };
  }

  async function decider(
    planning: MealPlan,
    repas: MealPlanEntry,
    decision: 'APPROVED' | 'REFUSED',
  ): Promise<void> {
    await request(app.getHttpServer())
      .post(`/api/meal-plans/${planning.id}/entries/${repas.id}/decision`)
      .set('Cookie', jeu.a.session)
      .send({ decision })
      .expect(200);
  }

  async function creerUneRecette(title: string): Promise<Recipe> {
    const reponse = await request(app.getHttpServer())
      .post('/api/recipes')
      .set('Cookie', jeu.a.session)
      .send({
        title,
        servings: 2,
        lines: [{ ingredientId: lentilles.id, quantity: 200, unit: 'G' }],
      })
      .expect(201);

    return reponse.body as Recipe;
  }

  function dansLeFoyer<T>(geste: () => Promise<T>): Promise<T> {
    return sousPortee(
      {
        espaces: [{ id: jeu.espaceFoyer, kind: 'HOUSEHOLD' }],
        typesAcceptes: ['HOUSEHOLD'],
      },
      geste,
    );
  }
});
