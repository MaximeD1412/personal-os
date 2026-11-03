import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  zCookedMeal,
  zHousehold,
  zMealPlanEntry,
  type CookedMeal,
  type Ingredient,
  type MealPlan,
  type MealPlanEntry,
  type PantryItem,
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
  type JeuDEspaces,
} from '../../../test/jeu-d-espaces';
import { champsEnErreur, codeDErreur } from '../../../test/code-d-erreur';
import { conformeA } from '../../../test/conforme';
import { AppModule } from '../app.module';

const REDIRECT_URI = 'http://app.exemple.test/api/auth/callback';
const DASHBOARD_URL = 'http://app.exemple.test/';
const ADRESSE_A = 'a@exemple.test';
const ADRESSE_B = 'b@exemple.test';

/** Un Repas cuisiné exactement conforme au contrat, sans un champ de plus. */
const UN_REPAS_CUISINE = zCookedMeal
  .extend({
    lines: z.array(
      zCookedMeal.shape.lines.element
        .extend({
          ingredient: zCookedMeal.shape.lines.element.shape.ingredient.strict(),
        })
        .strict(),
    ),
    shortfalls: z.array(
      zCookedMeal.shape.shortfalls.element
        .extend({
          ingredient:
            zCookedMeal.shape.shortfalls.element.shape.ingredient.strict(),
        })
        .strict(),
    ),
  })
  .strict();

const UN_REPAS = zMealPlanEntry
  .extend({ recipe: zMealPlanEntry.shape.recipe.unwrap().strict().nullable() })
  .strict();

const INCONNU = '00000000-0000-4000-8000-000000000000';

/**
 * La Cuisine vit dans l'Espace foyer : il n'y a pas de 404 croisé entre
 * Espaces personnels à prouver (ADR 0030). On prouve que les deux Comptes
 * déclarent sur le même stock.
 *
 * La campagne partage sa base entre les fichiers, et chaque Ingrédient n'a
 * qu'une ligne de stock : chaque test pose ses propres Ingrédients, et prend
 * une semaine de 2031 qui n'appartient qu'à lui.
 */
describe('Repas cuisiné', () => {
  let authentik: FauxAuthentik;
  let app: INestApplication;
  let jeu: JeuDEspaces;
  let prisma: PrismaService;
  let compteA: string;

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
    compteA = foyer.members[0].id;
  });

  afterAll(async () => {
    await app?.close();
    await authentik?.close();
  });

  describe('POST /cooked-meals', () => {
    it('baisse le stock des quantités déclarées, pas de celles de la recette, et répond conforme au contrat', async () => {
      const farine = await ingredient('Farine (cuisiné)');
      const lait = await ingredient('Lait (cuisiné)', 'MILLILITER');
      await stocker(farine, 1000, '2027-03-01');
      await stocker(lait, 1000, null);
      const recette = await creerUneRecette('Crêpes (cuisiné)', 4, [
        { ingredientId: farine.id, quantity: 250, unit: 'G' },
        { ingredientId: lait.id, quantity: 0.5, unit: 'L' },
      ]);
      const repas = await approuve('2031-01-06', { recipeId: recette.id });

      // On a mis un peu moins de farine et un peu plus de lait que prévu.
      const reponse = await request(app.getHttpServer())
        .post('/api/cooked-meals')
        .set('Cookie', jeu.b.session)
        .send({
          mealPlanEntryId: repas.id,
          lines: [
            { ingredientId: farine.id, quantity: 0.2, unit: 'KG' },
            { ingredientId: lait.id, quantity: 600, unit: 'ML' },
          ],
        })
        .expect(201)
        .expect(conformeA(UN_REPAS_CUISINE));

      const repasCuisine = reponse.body as CookedMeal;
      expect(repasCuisine).toMatchObject({
        mealPlanEntryId: repas.id,
        lines: [
          {
            ingredient: { id: farine.id, displayName: 'Farine (cuisiné)' },
            quantity: 0.2,
            unit: 'KG',
          },
          {
            ingredient: { id: lait.id, displayName: 'Lait (cuisiné)' },
            quantity: 600,
            unit: 'ML',
          },
        ],
        shortfalls: [],
      });
      expect(await enStock(farine)).toEqual({
        quantity: 800,
        expiresOn: '2027-03-01',
      });
      expect(await enStock(lait)).toEqual({ quantity: 400, expiresOn: null });
    });

    it('signale ce que le stock n’avait pas, sans quantité négative ni refus', async () => {
      const farine = await ingredient('Farine (manque)');
      const sucre = await ingredient('Sucre (manque)');
      await stocker(farine, 200, '2027-03-01');
      const repas = await approuve('2031-01-13', { title: 'Gâteau improvisé' });

      const reponse = await request(app.getHttpServer())
        .post('/api/cooked-meals')
        .set('Cookie', jeu.a.session)
        .send({
          mealPlanEntryId: repas.id,
          lines: [
            { ingredientId: farine.id, quantity: 500, unit: 'G' },
            { ingredientId: sucre.id, quantity: 100, unit: 'G' },
          ],
        })
        .expect(201)
        .expect(conformeA(UN_REPAS_CUISINE));

      expect((reponse.body as CookedMeal).shortfalls).toEqual([
        {
          ingredient: {
            id: farine.id,
            displayName: 'Farine (manque)',
            canonicalUnit: 'GRAM',
          },
          available: 200,
          missing: 300,
        },
        {
          ingredient: {
            id: sucre.id,
            displayName: 'Sucre (manque)',
            canonicalUnit: 'GRAM',
          },
          available: 0,
          missing: 100,
        },
      ]);
      // La ligne revient à zéro et perd sa péremption ; aucune n'est créée
      // pour le sucre, qu'on n'avait pas.
      expect(await enStock(farine)).toEqual({ quantity: 0, expiresOn: null });
      expect(await enStock(sucre)).toBeUndefined();
    });

    it('déclare les lignes libres d’un repas sans recette', async () => {
      const riz = await ingredient('Riz (libre)');
      await stocker(riz, 500, null);
      const repas = await approuve('2031-01-20', { title: 'Riz sauté' });

      await request(app.getHttpServer())
        .post('/api/cooked-meals')
        .set('Cookie', jeu.a.session)
        .send({
          mealPlanEntryId: repas.id,
          lines: [{ ingredientId: riz.id, quantity: 150, unit: 'G' }],
        })
        .expect(201)
        .expect(conformeA(UN_REPAS_CUISINE));

      expect(await enStock(riz)).toEqual({ quantity: 350, expiresOn: null });
    });

    it('refuse un repas déjà cuisiné, sans toucher au stock une seconde fois', async () => {
      const pates = await ingredient('Pâtes (deux fois)');
      await stocker(pates, 500, null);
      const repas = await approuve('2031-01-27', { title: 'Pâtes' });
      const declaration = {
        mealPlanEntryId: repas.id,
        lines: [{ ingredientId: pates.id, quantity: 100, unit: 'G' }],
      };

      await request(app.getHttpServer())
        .post('/api/cooked-meals')
        .set('Cookie', jeu.a.session)
        .send(declaration)
        .expect(201);
      await request(app.getHttpServer())
        .post('/api/cooked-meals')
        .set('Cookie', jeu.b.session)
        .send(declaration)
        .expect(422)
        .expect(codeDErreur('food.meal_already_cooked'));

      expect(await enStock(pates)).toEqual({ quantity: 400, expiresOn: null });
    });

    it('ne cuisine qu’une fois un repas déclaré deux fois en même temps', async () => {
      const oeufs = await ingredient('Œufs (simultané)', 'PIECE');
      await stocker(oeufs, 12, null);
      const repas = await approuve('2031-02-03', { title: 'Omelette' });
      const declaration = {
        mealPlanEntryId: repas.id,
        lines: [{ ingredientId: oeufs.id, quantity: 3, unit: 'PIECE' }],
      };

      const statuts = await Promise.all(
        [jeu.a, jeu.b].map(
          async (compte) =>
            (
              await request(app.getHttpServer())
                .post('/api/cooked-meals')
                .set('Cookie', compte.session)
                .send(declaration)
            ).status,
        ),
      );

      expect(statuts.sort()).toEqual([201, 422]);
      expect(await enStock(oeufs)).toEqual({ quantity: 9, expiresOn: null });
    });

    it('retire deux repas cuisinés en même temps du même stock, sans perdre de consommation', async () => {
      const beurre = await ingredient('Beurre (simultané)');
      await stocker(beurre, 250, null);
      const premier = await approuve('2031-02-10', { title: 'Tartines' });
      const second = await approuve('2031-02-11', { title: 'Purée' });

      await Promise.all(
        [premier, second].map((repas) =>
          request(app.getHttpServer())
            .post('/api/cooked-meals')
            .set('Cookie', jeu.a.session)
            .send({
              mealPlanEntryId: repas.id,
              lines: [{ ingredientId: beurre.id, quantity: 50, unit: 'G' }],
            })
            .expect(201),
        ),
      );

      expect(await enStock(beurre)).toEqual({ quantity: 150, expiresOn: null });
    });

    it('refuse un repas qui n’est pas approuvé', async () => {
      const sel = await ingredient('Sel (proposé)');
      const repas = await approuve('2031-02-17', { title: 'Soupe proposée' });
      // Attendue dans la portée : une requête Prisma ne part qu'à son `then`.
      await dansLeFoyer(
        async () =>
          await prisma.mealPlanEntry.update({
            where: { id: repas.id },
            data: { decision: 'PROPOSED' },
          }),
      );

      await request(app.getHttpServer())
        .post('/api/cooked-meals')
        .set('Cookie', jeu.a.session)
        .send({
          mealPlanEntryId: repas.id,
          lines: [{ ingredientId: sel.id, quantity: 1, unit: 'G' }],
        })
        .expect(422)
        .expect(codeDErreur('food.entry_not_approved'));
    });

    it('refuse une ligne dont l’unité ne se convertit pas, sans rien déstocker', async () => {
      const farine = await ingredient('Farine (inconvertible)');
      await stocker(farine, 500, null);
      const repas = await approuve('2031-02-24', { title: 'Pain' });

      await request(app.getHttpServer())
        .post('/api/cooked-meals')
        .set('Cookie', jeu.a.session)
        .send({
          mealPlanEntryId: repas.id,
          lines: [
            { ingredientId: farine.id, quantity: 100, unit: 'G' },
            { ingredientId: farine.id, quantity: 1, unit: 'L' },
          ],
        })
        .expect(422)
        .expect(codeDErreur('food.cooked_meal_unconvertible_line'));

      expect(await enStock(farine)).toEqual({ quantity: 500, expiresOn: null });
    });

    it('refuse un Ingrédient absent du catalogue', async () => {
      const repas = await approuve('2031-03-03', { title: 'Mystère' });

      await request(app.getHttpServer())
        .post('/api/cooked-meals')
        .set('Cookie', jeu.a.session)
        .send({
          mealPlanEntryId: repas.id,
          lines: [{ ingredientId: INCONNU, quantity: 1, unit: 'G' }],
        })
        .expect(422)
        .expect(codeDErreur('food.unknown_ingredient'));
    });

    it('répond 404 pour un Repas planifié inconnu', async () => {
      const sel = await ingredient('Sel (inconnu)');

      await request(app.getHttpServer())
        .post('/api/cooked-meals')
        .set('Cookie', jeu.a.session)
        .send({
          mealPlanEntryId: INCONNU,
          lines: [{ ingredientId: sel.id, quantity: 1, unit: 'G' }],
        })
        .expect(404)
        .expect(codeDErreur('food.entry_not_found'));
    });

    it.each([
      [
        'une quantité nulle',
        { lines: [{ ingredientId: INCONNU, quantity: 0, unit: 'G' }] },
        'lines.0.quantity',
      ],
      [
        'une unité inconnue',
        { lines: [{ ingredientId: INCONNU, quantity: 1, unit: 'CUP' }] },
        'lines.0.unit',
      ],
      ['aucune ligne', { lines: [] }, 'lines'],
    ])('refuse %s, sur le bon champ', async (_cas, saisie, champ) => {
      await request(app.getHttpServer())
        .post('/api/cooked-meals')
        .set('Cookie', jeu.a.session)
        .send({ mealPlanEntryId: INCONNU, ...saisie })
        .expect(400)
        .expect(champsEnErreur([champ]));
    });

    it('refuse sans session', async () => {
      await request(app.getHttpServer())
        .post('/api/cooked-meals')
        .send({
          mealPlanEntryId: INCONNU,
          lines: [{ ingredientId: INCONNU, quantity: 1, unit: 'G' }],
        })
        .expect(401);
    });
  });

  describe('GET /meal-plan-entries/:id', () => {
    it('lit un Repas planifié par son identifiant, conforme au contrat', async () => {
      const repas = await approuve('2031-03-10', { title: 'Gratin' });

      const reponse = await request(app.getHttpServer())
        .get(`/api/meal-plan-entries/${repas.id}`)
        .set('Cookie', jeu.b.session)
        .expect(200)
        .expect(conformeA(UN_REPAS));

      expect(reponse.body).toEqual(repas);
    });

    it('répond 404 pour un Repas planifié inconnu', async () => {
      await request(app.getHttpServer())
        .get(`/api/meal-plan-entries/${INCONNU}`)
        .set('Cookie', jeu.a.session)
        .expect(404)
        .expect(codeDErreur('food.entry_not_found'));
    });

    it('refuse sans session', async () => {
      await request(app.getHttpServer())
        .get(`/api/meal-plan-entries/${INCONNU}`)
        .expect(401);
    });
  });

  async function ingredient(
    displayName: string,
    canonicalUnit = 'GRAM',
  ): Promise<Ingredient> {
    const reponse = await request(app.getHttpServer())
      .post('/api/ingredients')
      .set('Cookie', jeu.a.session)
      .send({ displayName, canonicalUnit })
      .expect(201);
    return reponse.body as Ingredient;
  }

  async function stocker(
    { id }: Ingredient,
    quantity: number,
    expiresOn: string | null,
  ): Promise<void> {
    await request(app.getHttpServer())
      .put(`/api/pantry-items/${id}`)
      .set('Cookie', jeu.a.session)
      .send({ quantity, expiresOn })
      .expect(200);
  }

  /** La ligne de stock de l'Ingrédient, telle que l'écran de stock la lit. */
  async function enStock({
    id,
  }: Ingredient): Promise<
    Pick<PantryItem, 'quantity' | 'expiresOn'> | undefined
  > {
    const reponse = await request(app.getHttpServer())
      .get('/api/pantry-items')
      .set('Cookie', jeu.a.session)
      .expect(200);
    const ligne = (reponse.body as PantryItem[]).find(
      ({ ingredient }) => ingredient.id === id,
    );
    return ligne && { quantity: ligne.quantity, expiresOn: ligne.expiresOn };
  }

  async function creerUneRecette(
    title: string,
    servings: number,
    lines: Record<string, unknown>[],
  ): Promise<Recipe> {
    const reponse = await request(app.getHttpServer())
      .post('/api/recipes')
      .set('Cookie', jeu.a.session)
      .send({ title, servings, lines })
      .expect(201);
    return reponse.body as Recipe;
  }

  /** Un repas saisi à la main au planning de sa semaine : il est approuvé d'emblée. */
  async function approuve(
    day: string,
    plat: { recipeId: string } | { title: string },
  ): Promise<MealPlanEntry> {
    const planning = (
      await request(app.getHttpServer())
        .get('/api/meal-plans')
        .query({ week: lundiDe(day) })
        .set('Cookie', jeu.a.session)
        .expect(200)
    ).body as MealPlan;

    const reponse = await request(app.getHttpServer())
      .post(`/api/meal-plans/${planning.id}/entries`)
      .set('Cookie', jeu.a.session)
      .send({ day, moment: 'DINNER', participantIds: [compteA], ...plat })
      .expect(201);
    return reponse.body as MealPlanEntry;
  }

  function lundiDe(jour: string): string {
    const date = new Date(`${jour}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    return date.toISOString().slice(0, 10);
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
