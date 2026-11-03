import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  zAiTrace,
  zGenerationRound,
  zHousehold,
  zMealPlan,
  zMealPlanEntry,
  zRejectedSlot,
  type GenerationRound,
  type Ingredient,
  type MealPlan,
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
import { FournisseurIA } from '../ai/fournisseur-ia';
import { GenerateurIAFactice } from '../ai/generateur-ia.factice';
import { AppModule } from '../app.module';
import {
  GenerationRoundRepository,
  type LecturesDuTour,
} from './generation-round.repository';
import { RecipeRepository } from './recipe.repository';
import {
  BUT_GENERATION,
  type PropositionDeRepas,
} from './generation/proposition';

const REDIRECT_URI = 'http://app.exemple.test/api/auth/callback';
const DASHBOARD_URL = 'http://app.exemple.test/';
const ADRESSE_A = 'a@exemple.test';
const ADRESSE_B = 'b@exemple.test';

/** Un Tour et un Planning exactement conformes au contrat. */
const UN_REPAS = zMealPlanEntry
  .extend({ recipe: zMealPlanEntry.shape.recipe.unwrap().strict().nullable() })
  .strict();
const UN_TOUR = zGenerationRound
  .extend({
    rejected: z.array(zRejectedSlot.strict()),
    entries: z.array(UN_REPAS),
  })
  .strict();
const UN_PLANNING = zMealPlan.extend({ entries: z.array(UN_REPAS) }).strict();

const INCONNU = '00000000-0000-4000-8000-000000000000';

/**
 * Le modèle est le double de test (`GenerateurIAFactice`) : chaque test
 * programme les propositions que l'IA rendra, et vérifie ce que le contrôle,
 * hors du modèle, en laisse passer.
 *
 * La campagne partage sa base entre les fichiers : chaque test prend une
 * semaine de fin 2028 qui n'appartient qu'à lui, et les Préférences
 * alimentaires du Foyer sont remises à zéro avant chacun, pour qu'une
 * allergie laissée par un autre fichier ne décide pas à sa place.
 */
describe('Tours de génération', () => {
  let authentik: FauxAuthentik;
  let app: INestApplication;
  let jeu: JeuDEspaces;
  let prisma: PrismaService;
  let fournisseur: GenerateurIAFactice;
  let compteA: string;
  let compteB: string;
  let noix: Ingredient;
  let salade: Ingredient;
  let lentilles: Ingredient;
  let dahl: Recipe;

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
    fournisseur = app.get(FournisseurIA) as GenerateurIAFactice;

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

    noix = await ingredient('Noix (génération)', ['TREE_NUTS']);
    salade = await ingredient('Salade verte (génération)');
    lentilles = await ingredient('Lentilles corail (génération)');
    dahl = (
      await request(app.getHttpServer())
        .post('/api/recipes')
        .set('Cookie', jeu.a.session)
        .send({
          title: 'Dahl (génération)',
          servings: 4,
          lines: [{ ingredientId: lentilles.id, quantity: 300, unit: 'G' }],
        })
        .expect(201)
    ).body as Recipe;
  });

  beforeEach(async () => {
    await dansLeFoyer(() => prisma.foodPreference.deleteMany({}));
  });

  afterAll(async () => {
    await app?.close();
    await authentik?.close();
  });

  describe('POST /meal-plans/:id/generation-rounds', () => {
    it('propose un repas par créneau demandé, en Recette du Foyer ou en recette générée, et lie la trace au tour', async () => {
      const planning = await lire(jeu.a, '2028-11-06');
      programmer([
        { day: '2028-11-06', moment: 'LUNCH', recipeId: dahl.id, recipe: null },
        nouvelle('2028-11-06', 'DINNER', 'Salade aux noix', [
          'salade verte (Génération)',
          'NOIX (génération)',
        ]),
      ]);

      const reponse = await lancer(jeu.a, planning, {
        slots: [
          {
            day: '2028-11-06',
            moment: 'DINNER',
            participantIds: [compteA],
            guestCount: 1,
          },
          {
            day: '2028-11-06',
            moment: 'LUNCH',
            participantIds: [compteA, compteB],
          },
        ],
      })
        .expect(201)
        .expect(conformeA(UN_TOUR));

      const tour = reponse.body as GenerationRound;
      expect(tour).toMatchObject({ number: 1, rejected: [] });
      expect(tour.traceId).toEqual(expect.any(String));
      expect(tour.entries).toMatchObject([
        {
          day: '2028-11-06',
          moment: 'LUNCH',
          recipe: { id: dahl.id, title: 'Dahl (génération)' },
          title: null,
          participantIds: [compteA, compteB],
          guestCount: 0,
          servings: 2,
          decision: 'PROPOSED',
        },
        {
          day: '2028-11-06',
          moment: 'DINNER',
          recipe: { title: 'Salade aux noix' },
          participantIds: [compteA],
          guestCount: 1,
          servings: 2,
          decision: 'PROPOSED',
        },
      ]);

      const generee = (
        await request(app.getHttpServer())
          .get(`/api/recipes/${tour.entries[1].recipe?.id}`)
          .set('Cookie', jeu.b.session)
          .expect(200)
      ).body as Recipe;
      expect(generee).toMatchObject({
        source: 'GENERATED',
        servings: 2,
        steps: ['Assembler.'],
        lines: [
          { ingredient: { id: salade.id }, quantity: 80, unit: 'G' },
          { ingredient: { id: noix.id }, quantity: 80, unit: 'G' },
        ],
      });

      const relu = await request(app.getHttpServer())
        .get('/api/meal-plans')
        .query({ week: '2028-11-06' })
        .set('Cookie', jeu.b.session)
        .expect(200)
        .expect(conformeA(UN_PLANNING));
      expect((relu.body as MealPlan).rounds).toEqual([
        {
          id: tour.id,
          number: 1,
          traceId: tour.traceId,
          rejected: [],
          createdAt: tour.createdAt,
        },
      ]);
      expect((relu.body as MealPlan).entries.map(({ id }) => id)).toEqual(
        tour.entries.map(({ id }) => id),
      );

      const demande = await trace(tour);
      expect(demande.creneaux).toEqual([
        expect.objectContaining({ day: '2028-11-06', moment: 'LUNCH' }),
        expect.objectContaining({ day: '2028-11-06', moment: 'DINNER' }),
      ]);
      expect(demande.recettesDuFoyer).toContainEqual({
        recipeId: dahl.id,
        title: 'Dahl (génération)',
        ingredients: ['Lentilles corail (génération)'],
      });
    });

    it('rejette un plat aux noix pour un Participant allergique aux fruits à coque : le créneau reste vide, avec sa raison', async () => {
      await preference(compteB, 'ALLERGY', 'TREE_NUTS');
      const planning = await lire(jeu.a, '2028-11-13');
      programmer([
        nouvelle('2028-11-13', 'DINNER', 'Salade aux noix du 13', [
          'Salade verte (génération)',
          'Noix (génération)',
        ]),
      ]);

      const reponse = await lancer(jeu.a, planning, {
        slots: [
          {
            day: '2028-11-13',
            moment: 'DINNER',
            participantIds: [compteA, compteB],
          },
        ],
      })
        .expect(201)
        .expect(conformeA(UN_TOUR));

      const rejet = {
        slot: {
          day: '2028-11-13',
          moment: 'DINNER',
          participantIds: [compteA, compteB],
          guestCount: 0,
        },
        reason: 'ALLERGEN',
        ingredient: { label: 'Noix (génération)', ingredientId: noix.id },
        allergen: 'TREE_NUTS',
        participantIds: [compteB],
      };
      expect(reponse.body).toMatchObject({ entries: [], rejected: [rejet] });

      const relu = await lire(jeu.b, '2028-11-13');
      expect(relu.entries).toEqual([]);
      expect(relu.rounds.map(({ rejected }) => rejected)).toEqual([[rejet]]);
      expect(await recettesNommees('Salade aux noix du 13')).toBe(0);
    });

    it('ne présente pas une proposition dont un libellé est inconnu, et ne crée aucun Ingrédient', async () => {
      const planning = await lire(jeu.a, '2028-11-20');
      programmer([
        nouvelle('2028-11-20', 'LUNCH', 'Salade mystère', [
          'Salade verte (génération)',
          'Sauce mystère (génération)',
        ]),
      ]);

      const reponse = await lancer(jeu.a, planning, {
        slots: [
          { day: '2028-11-20', moment: 'LUNCH', participantIds: [compteA] },
        ],
      }).expect(201);

      expect(reponse.body).toMatchObject({
        entries: [],
        rejected: [
          {
            reason: 'UNKNOWN_INGREDIENT',
            ingredient: {
              label: 'Sauce mystère (génération)',
              ingredientId: null,
            },
            allergen: null,
          },
        ],
      });
      expect(
        await dansLeFoyer(() =>
          prisma.ingredient.count({
            where: { name: { contains: 'mystere' } },
          }),
        ),
      ).toBe(0);
      expect(await recettesNommees('Salade mystère')).toBe(0);
    });

    it("propose le plat aux noix quand l'allergique est absent du repas", async () => {
      await preference(compteB, 'ALLERGY', 'TREE_NUTS');
      const planning = await lire(jeu.a, '2028-11-27');
      programmer([
        nouvelle('2028-11-27', 'DINNER', 'Salade aux noix du 27', [
          'Noix (génération)',
        ]),
      ]);

      const reponse = await lancer(jeu.a, planning, {
        slots: [
          { day: '2028-11-27', moment: 'DINNER', participantIds: [compteA] },
        ],
      }).expect(201);

      expect(reponse.body).toMatchObject({
        rejected: [],
        entries: [
          {
            day: '2028-11-27',
            recipe: { title: 'Salade aux noix du 27' },
            decision: 'PROPOSED',
          },
        ],
      });
    });

    it('ne régénère au tour suivant que les repas refusés et les créneaux écartés, jamais un repas approuvé', async () => {
      const planning = await lire(jeu.a, '2028-12-04');
      programmer([
        { day: '2028-12-04', moment: 'LUNCH', recipeId: dahl.id, recipe: null },
        {
          day: '2028-12-04',
          moment: 'DINNER',
          recipeId: dahl.id,
          recipe: null,
        },
        nouvelle('2028-12-05', 'LUNCH', 'Mystère', ['Sauce mystère']),
      ]);
      const premier = (
        await lancer(jeu.a, planning, {
          slots: [
            { day: '2028-12-04', moment: 'LUNCH', participantIds: [compteA] },
            { day: '2028-12-04', moment: 'DINNER', participantIds: [compteA] },
            { day: '2028-12-05', moment: 'LUNCH', participantIds: [compteB] },
          ],
        }).expect(201)
      ).body as GenerationRound;
      const [dejeuner, diner] = premier.entries;
      await decider(planning, dejeuner.id, 'APPROVED');
      await decider(planning, diner.id, 'REFUSED');

      programmer([
        nouvelle('2028-12-04', 'DINNER', 'Salade du 4', [
          'Salade verte (génération)',
        ]),
        { day: '2028-12-05', moment: 'LUNCH', recipeId: dahl.id, recipe: null },
        { day: '2028-12-06', moment: 'LUNCH', recipeId: dahl.id, recipe: null },
      ]);
      const second = (
        await lancer(jeu.b, planning, {
          slots: [
            { day: '2028-12-06', moment: 'LUNCH', participantIds: [compteA] },
          ],
        })
          .expect(201)
          .expect(conformeA(UN_TOUR))
      ).body as GenerationRound;

      expect(second).toMatchObject({ number: 2, rejected: [] });
      expect(second.entries).toMatchObject([
        {
          day: '2028-12-04',
          moment: 'DINNER',
          recipe: { title: 'Salade du 4' },
          participantIds: [compteA],
          decision: 'PROPOSED',
        },
        {
          day: '2028-12-05',
          moment: 'LUNCH',
          recipe: { id: dahl.id },
          participantIds: [compteB],
          decision: 'PROPOSED',
        },
      ]);
      expect((await trace(second)).creneaux).toEqual([
        expect.objectContaining({ day: '2028-12-04', moment: 'DINNER' }),
        expect.objectContaining({ day: '2028-12-05', moment: 'LUNCH' }),
      ]);

      const relu = await lire(jeu.a, '2028-12-04');
      expect(
        relu.entries.map(({ id, day, moment, decision }) => ({
          id,
          day,
          moment,
          decision,
        })),
      ).toEqual([
        {
          id: dejeuner.id,
          day: '2028-12-04',
          moment: 'LUNCH',
          decision: 'APPROVED',
        },
        {
          id: second.entries[0].id,
          day: '2028-12-04',
          moment: 'DINNER',
          decision: 'PROPOSED',
        },
        {
          id: second.entries[1].id,
          day: '2028-12-05',
          moment: 'LUNCH',
          decision: 'PROPOSED',
        },
      ]);
      expect(relu.rounds.map(({ number }) => number)).toEqual([1, 2]);
    });

    it('contrôle la Recette du Foyer telle qu’elle est à la réponse du modèle : des noix ajoutées pendant la génération l’écartent', async () => {
      await preference(compteB, 'ALLERGY', 'TREE_NUTS');
      const pesto = (
        await request(app.getHttpServer())
          .post('/api/recipes')
          .set('Cookie', jeu.a.session)
          .send({
            title: 'Pesto (génération)',
            servings: 2,
            lines: [{ ingredientId: salade.id, quantity: 100, unit: 'G' }],
          })
          .expect(201)
      ).body as Recipe;
      const planning = await lire(jeu.a, '2029-06-04');
      fournisseur.programmerPendant(
        BUT_GENERATION,
        {
          propositions: [
            {
              day: '2029-06-04',
              moment: 'LUNCH',
              recipeId: pesto.id,
              recipe: null,
            },
          ],
        },
        () =>
          request(app.getHttpServer())
            .patch(`/api/recipes/${pesto.id}`)
            .set('Cookie', jeu.b.session)
            .send({
              lines: [
                { ingredientId: salade.id, quantity: 100, unit: 'G' },
                { ingredientId: noix.id, quantity: 30, unit: 'G' },
              ],
            })
            .expect(200),
      );

      const reponse = await lancer(jeu.a, planning, {
        slots: [
          {
            day: '2029-06-04',
            moment: 'LUNCH',
            participantIds: [compteA, compteB],
          },
        ],
      }).expect(201);

      expect(reponse.body).toMatchObject({
        entries: [],
        rejected: [
          {
            reason: 'ALLERGEN',
            ingredient: { ingredientId: noix.id },
            allergen: 'TREE_NUTS',
            participantIds: [compteB],
          },
        ],
      });
      expect((await lire(jeu.a, '2029-06-04')).entries).toEqual([]);
    });

    it('écarte une Recette du Foyer à laquelle un Ingrédient allergène est ajouté juste avant sa relecture', async () => {
      await preference(compteB, 'ALLERGY', 'TREE_NUTS');
      const tartine = (
        await request(app.getHttpServer())
          .post('/api/recipes')
          .set('Cookie', jeu.a.session)
          .send({
            title: 'Tartine (génération)',
            servings: 2,
            lines: [{ ingredientId: salade.id, quantity: 50, unit: 'G' }],
          })
          .expect(201)
      ).body as Recipe;
      const planning = await lire(jeu.a, '2029-07-09');
      programmer([
        {
          day: '2029-07-09',
          moment: 'LUNCH',
          recipeId: tartine.id,
          recipe: null,
        },
      ]);

      // La relecture des Recettes, après la réponse du modèle, est la seconde
      // lecture du tour : juste avant, l'autre Compte crée un Ingrédient aux
      // fruits à coque et l'ajoute à la Recette.
      const recettes = app.get(RecipeRepository);
      const lister = recettes.lister.bind(recettes);
      let lectures = 0;
      const espion = jest
        .spyOn(recettes, 'lister')
        .mockImplementation(async (...args) => {
          lectures += 1;
          if (lectures === 2) {
            const pistache = await ingredient('Pistache (génération)', [
              'TREE_NUTS',
            ]);
            await request(app.getHttpServer())
              .patch(`/api/recipes/${tartine.id}`)
              .set('Cookie', jeu.b.session)
              .send({
                lines: [
                  { ingredientId: salade.id, quantity: 50, unit: 'G' },
                  { ingredientId: pistache.id, quantity: 20, unit: 'G' },
                ],
              })
              .expect(200);
          }
          return lister(...args);
        });

      try {
        const reponse = await lancer(jeu.a, planning, {
          slots: [
            {
              day: '2029-07-09',
              moment: 'LUNCH',
              participantIds: [compteA, compteB],
            },
          ],
        }).expect(201);

        expect(lectures).toBe(2);
        expect(reponse.body).toMatchObject({
          entries: [],
          rejected: [
            {
              reason: 'ALLERGEN',
              ingredient: { label: 'Pistache (génération)' },
              allergen: 'TREE_NUTS',
              participantIds: [compteB],
            },
          ],
        });
        expect((await lire(jeu.a, '2029-07-09')).entries).toEqual([]);
      } finally {
        espion.mockRestore();
      }
    });

    it('écarte le plat aux noix quand l’allergie est déclarée pendant la génération', async () => {
      const planning = await lire(jeu.a, '2029-06-11');
      fournisseur.programmerPendant(
        BUT_GENERATION,
        {
          propositions: [
            nouvelle('2029-06-11', 'DINNER', 'Salade aux noix du 11 juin', [
              'Salade verte (génération)',
              'Noix (génération)',
            ]),
          ],
        },
        () => preference(compteB, 'ALLERGY', 'TREE_NUTS'),
      );

      const reponse = await lancer(jeu.a, planning, {
        slots: [
          {
            day: '2029-06-11',
            moment: 'DINNER',
            participantIds: [compteB],
          },
        ],
      }).expect(201);

      expect(reponse.body).toMatchObject({
        entries: [],
        rejected: [{ reason: 'ALLERGEN', participantIds: [compteB] }],
      });
      expect(await recettesNommees('Salade aux noix du 11 juin')).toBe(0);
    });

    it('refuse en 422 un tour dont le planning a changé pendant la génération, sans rien écrire', async () => {
      const planning = await lire(jeu.a, '2029-06-18');
      fournisseur.programmerPendant(
        BUT_GENERATION,
        {
          propositions: [
            {
              day: '2029-06-18',
              moment: 'DINNER',
              recipeId: dahl.id,
              recipe: null,
            },
          ],
        },
        () =>
          request(app.getHttpServer())
            .post(`/api/meal-plans/${planning.id}/entries`)
            .set('Cookie', jeu.b.session)
            .send({
              day: '2029-06-18',
              moment: 'DINNER',
              title: 'Restes',
              participantIds: [compteB],
            })
            .expect(201),
      );

      await lancer(jeu.a, planning, {
        slots: [
          {
            day: '2029-06-18',
            moment: 'DINNER',
            participantIds: [compteA, compteB],
          },
        ],
      })
        .expect(422)
        .expect(codeDErreur('food.round_outdated'));

      const relu = await lire(jeu.a, '2029-06-18');
      expect(relu.rounds).toEqual([]);
      expect(relu.entries).toMatchObject([
        { title: 'Restes', decision: 'APPROVED' },
      ]);
    });

    it("n'écrit rien quand le planning, une Recette, un Ingrédient ou les Préférences d'un Participant ont changé depuis la lecture du contrôle", async () => {
      // Une Trace IA réelle, que le tour écrit à la main citera.
      const temoin = await lire(jeu.a, '2029-07-02');
      programmer([
        { day: '2029-07-02', moment: 'LUNCH', recipeId: dahl.id, recipe: null },
      ]);
      const { traceId } = (
        await lancer(jeu.a, temoin, {
          slots: [
            { day: '2029-07-02', moment: 'LUNCH', participantIds: [compteA] },
          ],
        }).expect(201)
      ).body as GenerationRound;

      const planning = await lire(jeu.a, '2029-06-25');
      const lu = await dansLeFoyer(async () => ({
        planning: (
          await prisma.mealPlan.findUniqueOrThrow({
            where: { id: planning.id },
            select: { version: true },
          })
        ).version,
        recettes: [
          await prisma.recipe.findUniqueOrThrow({
            where: { id: dahl.id },
            select: { id: true, updatedAt: true },
          }),
        ],
        ingredients: [
          await prisma.ingredient.findUniqueOrThrow({
            where: { id: lentilles.id },
            select: { id: true, updatedAt: true },
          }),
        ],
        comptes: [
          await prisma.user.findUniqueOrThrow({
            where: { id: compteB },
            select: { id: true, foodPreferencesVersion: true },
          }),
        ],
      }));
      const tours = app.get(GenerationRoundRepository);
      const ecrire = (lectures: LecturesDuTour) =>
        dansLeFoyer(() =>
          tours.enregistrer(planning.id, {
            number: 1,
            traceId: traceId ?? '',
            rejected: [],
            lectures,
            repas: [
              {
                day: '2029-06-25',
                moment: 'LUNCH',
                participantIds: [compteA, compteB],
                guestCount: 0,
                recette: { recipeId: dahl.id },
              },
            ],
          }),
        );
      const avant = new Date(0);

      for (const perime of [
        { ...lu, planning: lu.planning - 1 },
        { ...lu, recettes: [{ id: dahl.id, updatedAt: avant }] },
        { ...lu, ingredients: [{ id: lentilles.id, updatedAt: avant }] },
        {
          ...lu,
          comptes: [{ id: compteB, foodPreferencesVersion: -1 }],
        },
      ]) {
        await expect(ecrire(perime)).rejects.toMatchObject({ code: 'P2025' });
        expect(await lire(jeu.a, '2029-06-25')).toMatchObject({
          entries: [],
          rounds: [],
        });
      }

      await ecrire(lu);
      expect(
        (await lire(jeu.a, '2029-06-25')).entries.map(
          ({ decision }) => decision,
        ),
      ).toEqual(['PROPOSED']);
    });

    it("ne laisse aucun tour quand l'IA ne rend pas une sortie valide", async () => {
      const planning = await lire(jeu.a, '2028-12-11');
      fournisseur.programmerTexte(BUT_GENERATION, 'pas du JSON');
      fournisseur.programmerTexte(BUT_GENERATION, '{"propositions": 3}');

      await lancer(jeu.a, planning, {
        slots: [
          { day: '2028-12-11', moment: 'LUNCH', participantIds: [compteA] },
        ],
      })
        .expect(502)
        .expect(codeDErreur('ai.invalid_output'));

      const relu = await lire(jeu.a, '2028-12-11');
      expect(relu.rounds).toEqual([]);
      expect(relu.entries).toEqual([]);
    });

    it('refuse en 400 un créneau mal formé, en nommant son champ', async () => {
      const planning = await lire(jeu.a, '2028-12-18');

      await lancer(jeu.a, planning, {
        slots: [{ day: '18/12/2028', moment: 'LUNCH', participantIds: [] }],
      })
        .expect(400)
        .expect(champsEnErreur(['slots.0.day']));
      await lancer(jeu.a, planning, {
        slots: [{ day: '2028-12-18', moment: 'BRUNCH', participantIds: [] }],
      })
        .expect(400)
        .expect(champsEnErreur(['slots.0.moment']));
    });

    it('refuse en 422 un tour sans rien à remplir, sur un repas encore proposé, ou sur un planning arrêté', async () => {
      const planning = await lire(jeu.a, '2028-12-25');

      await lancer(jeu.a, planning, {})
        .expect(422)
        .expect(codeDErreur('food.round_not_allowed'));

      programmer([
        { day: '2028-12-25', moment: 'LUNCH', recipeId: dahl.id, recipe: null },
      ]);
      const premier = (
        await lancer(jeu.a, planning, {
          slots: [
            { day: '2028-12-25', moment: 'LUNCH', participantIds: [compteA] },
          ],
        }).expect(201)
      ).body as GenerationRound;

      await lancer(jeu.a, planning, {})
        .expect(422)
        .expect(codeDErreur('food.round_not_allowed'));

      await decider(planning, premier.entries[0].id, 'APPROVED');
      await lancer(jeu.a, planning, {})
        .expect(422)
        .expect(codeDErreur('food.round_not_allowed'));

      await request(app.getHttpServer())
        .post(`/api/meal-plans/${planning.id}/stop`)
        .set('Cookie', jeu.a.session)
        .expect(200);
      await lancer(jeu.a, planning, {})
        .expect(422)
        .expect(codeDErreur('food.round_not_allowed'));

      expect((await lire(jeu.a, '2028-12-25')).rounds).toHaveLength(1);
    });

    it('refuse en 422 un créneau hors de la semaine, sans Participant, ou pour un Compte hors du Foyer', async () => {
      const planning = await lire(jeu.a, '2029-05-07');
      const cas = [
        [
          { day: '2029-05-14', moment: 'LUNCH', participantIds: [compteA] },
          'food.entry_out_of_week',
        ],
        [
          { day: '2029-05-07', moment: 'LUNCH', participantIds: [] },
          'food.entry_no_participant',
        ],
        [
          { day: '2029-05-07', moment: 'LUNCH', participantIds: [INCONNU] },
          'food.unknown_participant',
        ],
      ] as const;

      for (const [creneau, code] of cas) {
        await lancer(jeu.a, planning, { slots: [creneau] })
          .expect(422)
          .expect(codeDErreur(code));
      }
      expect((await lire(jeu.a, '2029-05-07')).rounds).toEqual([]);
    });

    it('refuse en 404 un planning inconnu', async () => {
      await request(app.getHttpServer())
        .post(`/api/meal-plans/${INCONNU}/generation-rounds`)
        .set('Cookie', jeu.a.session)
        .send({})
        .expect(404)
        .expect(codeDErreur('food.plan_not_found'));
    });

    it('refuse en 401 un tour sans session', async () => {
      await request(app.getHttpServer())
        .post(`/api/meal-plans/${INCONNU}/generation-rounds`)
        .send({})
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  async function ingredient(
    displayName: string,
    allergens: string[] = [],
  ): Promise<Ingredient> {
    const reponse = await request(app.getHttpServer())
      .post('/api/ingredients')
      .set('Cookie', jeu.a.session)
      .send({ displayName, canonicalUnit: 'GRAM', allergens })
      .expect(201);

    return reponse.body as Ingredient;
  }

  async function preference(
    userId: string,
    kind: 'ALLERGY' | 'EXCLUDED' | 'DISLIKED',
    allergen: string,
  ): Promise<void> {
    await request(app.getHttpServer())
      .post('/api/food-preferences')
      .set('Cookie', jeu.a.session)
      .send({ userId, kind, target: 'ALLERGEN', allergen })
      .expect(201);
  }

  async function lire(compte: CompteDeTest, week: string): Promise<MealPlan> {
    const reponse = await request(app.getHttpServer())
      .get('/api/meal-plans')
      .query({ week })
      .set('Cookie', compte.session)
      .expect(200);

    return reponse.body as MealPlan;
  }

  function lancer(compte: CompteDeTest, planning: MealPlan, saisie: object) {
    return request(app.getHttpServer())
      .post(`/api/meal-plans/${planning.id}/generation-rounds`)
      .set('Cookie', compte.session)
      .send(saisie);
  }

  async function decider(
    planning: MealPlan,
    id: string,
    decision: 'APPROVED' | 'REFUSED',
  ): Promise<void> {
    await request(app.getHttpServer())
      .post(`/api/meal-plans/${planning.id}/entries/${id}/decision`)
      .set('Cookie', jeu.a.session)
      .send({ decision })
      .expect(200);
  }

  function programmer(propositions: PropositionDeRepas[]): void {
    fournisseur.programmer(BUT_GENERATION, { propositions });
  }

  function nouvelle(
    day: string,
    moment: 'LUNCH' | 'DINNER',
    title: string,
    labels: string[],
  ): PropositionDeRepas {
    return {
      day,
      moment,
      recipeId: null,
      recipe: {
        title,
        servings: 2,
        steps: ['Assembler.'],
        ingredients: labels.map((label) => ({
          label,
          quantity: 80,
          unit: 'G',
        })),
      },
    };
  }

  /** La demande faite au modèle, telle que sa Trace IA la garde. */
  async function trace(tour: GenerationRound) {
    const reponse = await request(app.getHttpServer())
      .get(`/api/ai-traces/${tour.traceId}`)
      .set('Cookie', jeu.a.session)
      .expect(200);

    return JSON.parse(zAiTrace.parse(reponse.body).input) as {
      creneaux: { day: string; moment: string }[];
      recettesDuFoyer: unknown[];
    };
  }

  function recettesNommees(title: string): Promise<number> {
    return dansLeFoyer(() => prisma.recipe.count({ where: { title } }));
  }

  /** Une requête Prisma est paresseuse : elle s'attend dans la portée. */
  function dansLeFoyer<T>(geste: () => PromiseLike<T>): Promise<T> {
    return sousPortee(
      {
        espaces: [{ id: jeu.espaceFoyer, kind: 'HOUSEHOLD' }],
        typesAcceptes: ['HOUSEHOLD'],
      },
      async () => await geste(),
    );
  }
});
