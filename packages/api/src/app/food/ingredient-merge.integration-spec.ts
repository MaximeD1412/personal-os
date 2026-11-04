import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  zHousehold,
  zIngredient,
  type FoodPreference,
  type Ingredient,
  type IngredientResolution,
  type MealPlan,
  type MealPlanEntry,
  type PantryItem,
  type Product,
  type Recipe,
} from '@personal-os/contracts';
import {
  ID_ESPACE_FOYER,
  PrismaService,
  sousPortee,
} from '@personal-os/database';
import request from 'supertest';
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

const UN_INGREDIENT = zIngredient.strict();

const INCONNU = '00000000-0000-4000-8000-000000000000';

const SOUS_L_ESPACE_FOYER = {
  espaces: [{ id: ID_ESPACE_FOYER, kind: 'HOUSEHOLD' as const }],
  typesAcceptes: ['HOUSEHOLD' as const],
};

/**
 * La fusion de deux Ingrédients en doublon (CUISINE-4). Le catalogue est
 * global et la Cuisine vit dans l'Espace foyer : il n'y a pas de 404 croisé à
 * prouver (ADR 0030).
 *
 * La campagne partage sa base entre les fichiers : chaque test nomme ses
 * Ingrédients d'un libellé qui lui est propre, et prend une semaine de 2035
 * qui n'appartient qu'à lui.
 */
describe("Fusion d'Ingrédients", () => {
  let authentik: FauxAuthentik;
  let app: INestApplication;
  let jeu: JeuDEspaces;
  let prisma: PrismaService;
  let compteA: string;
  let compteB: string;
  let semaines = 0;

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
  });

  afterAll(async () => {
    await app?.close();
    await authentik?.close();
  });

  describe('POST /ingredients/:id/merge', () => {
    it("repointe tout ce qui cite le doublon vers l'Ingrédient conservé, et rend celui-ci conforme au contrat", async () => {
      const doublon = await ingredient('Noix de cajou grillées (fusion)');
      const conserve = await ingredient('Noix de cajou (fusion)');
      await rattacher('cajou grille (fusion)', doublon);
      const boite = await produit(doublon, 'sachet', 200);
      await preferer(doublon, boite);
      const recette = await creerUneRecette('Curry de cajou (fusion)', [
        { ingredientId: doublon.id, quantity: 80, unit: 'G' },
      ]);
      const planning = await unPlanning();
      const repas = await ajouter(planning, { recipeId: recette.id });
      await cuisiner(repas, doublon);
      await arreter(planning);
      const liste = await produireUneListe(planning);
      await request(app.getHttpServer())
        .post(`/api/shopping-lists/${liste}/items`)
        .set('Cookie', jeu.a.session)
        .send({ ingredientId: doublon.id, quantity: 100 })
        .expect(201);
      await preference(compteB, 'EXCLUDED', doublon);

      const reponse = await request(app.getHttpServer())
        .post(`/api/ingredients/${doublon.id}/merge`)
        .set('Cookie', jeu.a.session)
        .send({ intoId: conserve.id })
        .expect(200)
        .expect(conformeA(UN_INGREDIENT));

      expect(reponse.body).toMatchObject({
        id: conserve.id,
        displayName: 'Noix de cajou (fusion)',
        // Le conservé n'avait pas de Produit préféré : il reprend celui du doublon.
        preferredProductId: boite.id,
      });
      expect(await references(doublon)).toEqual({
        alias: 0,
        recipeLines: 0,
        pantryItems: 0,
        shoppingListItems: 0,
        cookedMealLines: 0,
        foodPreferences: 0,
        products: 0,
      });
      expect(await references(conserve)).toEqual({
        alias: 2,
        recipeLines: 1,
        pantryItems: 0,
        shoppingListItems: 1,
        cookedMealLines: 1,
        foodPreferences: 1,
        products: 1,
      });
      await request(app.getHttpServer())
        .get(`/api/ingredients/${doublon.id}`)
        .set('Cookie', jeu.a.session)
        .expect(404);
    });

    it('fait reconnaître au résolveur le nom du doublon et ses Alias', async () => {
      const doublon = await ingredient('Pois chiches cuits (fusion)');
      const conserve = await ingredient('Pois chiches (fusion)');
      await rattacher('pois chiche en boite (fusion)', doublon);

      await fusionner(doublon, conserve);

      const reponse = await request(app.getHttpServer())
        .post('/api/ingredients/resolve')
        .set('Cookie', jeu.b.session)
        .send({
          labels: [
            'Pois chiches cuits (fusion)',
            'Pois chiche en boîte (fusion)',
          ],
        })
        .expect(200);
      expect(reponse.body as IngredientResolution[]).toEqual([
        { label: 'Pois chiches cuits (fusion)', ingredientId: conserve.id },
        { label: 'Pois chiche en boîte (fusion)', ingredientId: conserve.id },
      ]);
    });

    it('additionne les deux lignes de stock et garde la péremption la plus proche', async () => {
      const doublon = await ingredient('Crème liquide entière (fusion)');
      const conserve = await ingredient('Crème liquide (fusion)');
      await stocker(conserve, 200, '2026-12-10');
      await stocker(doublon, 300.5, '2026-11-20');

      await fusionner(doublon, conserve);

      expect(await enStock(conserve)).toEqual({
        quantity: 500.5,
        expiresOn: '2026-11-20',
      });
      expect(await enStock(doublon)).toBeUndefined();
    });

    it("reprend la ligne de stock du doublon quand le conservé n'en a pas", async () => {
      const doublon = await ingredient('Lentilles corail sèches (fusion)');
      const conserve = await ingredient('Lentilles corail (fusion)');
      await stocker(doublon, 750, null);

      await fusionner(doublon, conserve);

      expect(await enStock(conserve)).toEqual({
        quantity: 750,
        expiresOn: null,
      });
    });

    it('dédoublonne les Préférences que la fusion rendrait identiques', async () => {
      const doublon = await ingredient('Céleri branche (fusion)');
      const conserve = await ingredient('Céleri (fusion)');
      await preference(compteA, 'DISLIKED', doublon);
      await preference(compteA, 'DISLIKED', conserve);
      await preference(compteA, 'EXCLUDED', doublon);
      await preference(compteB, 'DISLIKED', doublon);

      await fusionner(doublon, conserve);

      const reponse = await request(app.getHttpServer())
        .get('/api/food-preferences')
        .set('Cookie', jeu.a.session)
        .expect(200);
      const duConserve = (reponse.body as FoodPreference[])
        .filter(
          (preference) =>
            preference.target === 'INGREDIENT' &&
            preference.ingredientId === conserve.id,
        )
        .map(({ userId, kind }) => ({ userId, kind }));
      expect(duConserve).toHaveLength(3);
      expect(duConserve).toEqual(
        expect.arrayContaining([
          { userId: compteA, kind: 'DISLIKED' },
          { userId: compteA, kind: 'EXCLUDED' },
          { userId: compteB, kind: 'DISLIKED' },
        ]),
      );
    });

    it('garde le Produit préféré du conservé, et y ajoute les Produits du doublon', async () => {
      const doublon = await ingredient('Tomates pelées (fusion)');
      const conserve = await ingredient('Tomates en conserve (fusion)');
      const sienne = await produit(conserve, 'boîte', 400);
      const celleDuDoublon = await produit(doublon, 'brique', 500);
      await preferer(conserve, sienne);
      await preferer(doublon, celleDuDoublon);

      const fusionne = await fusionner(doublon, conserve);

      expect(fusionne.preferredProductId).toBe(sienne.id);
      const produits = await request(app.getHttpServer())
        .get(`/api/ingredients/${conserve.id}/products`)
        .set('Cookie', jeu.a.session)
        .expect(200);
      expect((produits.body as Product[]).map(({ id }) => id).sort()).toEqual(
        [sienne.id, celleDuDoublon.id].sort(),
      );
    });

    it("refuse en 422 un doublon dont le nom est l'Alias d'un troisième Ingrédient, sans rien écrire", async () => {
      const autre = await ingredient('Tomates (fusion alias)');
      await rattacher('tomates fraiches (fusion alias)', autre);
      // La création ne compare un nom qu'aux autres noms, pas aux Alias.
      const doublon = await ingredient('Tomates fraîches (fusion alias)');
      const conserve = await ingredient('Tomates grappe (fusion alias)');
      await stocker(doublon, 300, null);

      await request(app.getHttpServer())
        .post(`/api/ingredients/${doublon.id}/merge`)
        .set('Cookie', jeu.a.session)
        .send({ intoId: conserve.id })
        .expect(422)
        .expect(codeDErreur('food.merge_alias_conflict'));

      expect(
        await prisma.ingredientAlias.findUnique({
          where: { label: 'tomates fraiches (fusion alias)' },
          select: { ingredientId: true },
        }),
      ).toEqual({ ingredientId: autre.id });
      expect(await references(doublon)).toMatchObject({ pantryItems: 1 });
      await request(app.getHttpServer())
        .get(`/api/ingredients/${doublon.id}`)
        .set('Cookie', jeu.a.session)
        .expect(200);
    });

    it("reprend l'Alias du nom du doublon qu'il portait déjà", async () => {
      const conserve = await ingredient('Échalotes (fusion alias)');
      await rattacher('echalote grise (fusion alias)', conserve);
      // Le doublon porte un nom qui était déjà l'Alias du conservé.
      const doublon = await ingredient('Échalote grise (fusion alias)');

      await fusionner(doublon, conserve);

      expect(
        await prisma.ingredientAlias.findUnique({
          where: { label: doublon.name },
          select: { ingredientId: true },
        }),
      ).toEqual({ ingredientId: conserve.id });
    });

    it('tranche deux fusions inverses simultanées sans erreur serveur', async () => {
      const paires = await Promise.all(
        [1, 2, 3, 4, 5, 6].map(async (n) => [
          await ingredient(`Courgette ${n} (fusion croisée)`),
          await ingredient(`Courgette verte ${n} (fusion croisée)`),
        ]),
      );
      for (const [a, b] of paires) {
        await stocker(a, 100, null);
        await stocker(b, 200, null);
      }

      const reponses = await Promise.all(
        paires.flatMap(([a, b]) => [
          request(app.getHttpServer())
            .post(`/api/ingredients/${a.id}/merge`)
            .set('Cookie', jeu.a.session)
            .send({ intoId: b.id }),
          request(app.getHttpServer())
            .post(`/api/ingredients/${b.id}/merge`)
            .set('Cookie', jeu.b.session)
            .send({ intoId: a.id }),
        ]),
      );

      for (const [i, [a, b]] of paires.entries()) {
        const [ab, ba] = [reponses[2 * i], reponses[2 * i + 1]];
        // L'une gagne ; l'autre relit et trouve l'un des deux disparu.
        expect([ab.status, ba.status].sort()).toEqual([
          200,
          expect.any(Number),
        ]);
        expect([ab.status, ba.status].filter((s) => s === 200)).toHaveLength(1);
        for (const perdante of [ab, ba].filter(
          ({ status }) => status !== 200,
        )) {
          expect([404, 422]).toContain(perdante.status);
        }
        const restants = await prisma.ingredient.count({
          where: { id: { in: [a.id, b.id] } },
        });
        expect(restants).toBe(1);
        const garde = ab.status === 200 ? b : a;
        expect(await enStock(garde)).toEqual({
          quantity: 300,
          expiresOn: null,
        });
      }
    });

    it('refuse en 422 deux Ingrédients qui ne se comptent pas dans la même Unité canonique', async () => {
      const doublon = await ingredient(
        'Lait demi-écrémé (fusion)',
        'MILLILITER',
      );
      const conserve = await ingredient('Lait (fusion)', 'GRAM');

      await request(app.getHttpServer())
        .post(`/api/ingredients/${doublon.id}/merge`)
        .set('Cookie', jeu.a.session)
        .send({ intoId: conserve.id })
        .expect(422)
        .expect(codeDErreur('food.merge_unit_mismatch'));
    });

    it('refuse en 422 de fusionner un Ingrédient avec lui-même', async () => {
      const sel = await ingredient('Sel de Guérande (fusion)');

      await request(app.getHttpServer())
        .post(`/api/ingredients/${sel.id}/merge`)
        .set('Cookie', jeu.a.session)
        .send({ intoId: sel.id })
        .expect(422)
        .expect(codeDErreur('food.merge_same_ingredient'));
    });

    it("refuse en 422 un Ingrédient conservé qui n'est pas au catalogue", async () => {
      const poivre = await ingredient('Poivre noir (fusion)');

      await request(app.getHttpServer())
        .post(`/api/ingredients/${poivre.id}/merge`)
        .set('Cookie', jeu.a.session)
        .send({ intoId: INCONNU })
        .expect(422)
        .expect(codeDErreur('food.unknown_ingredient'));
    });

    it('répond 404 pour un doublon inconnu', async () => {
      const poivre = await ingredient('Poivre blanc (fusion)');

      await request(app.getHttpServer())
        .post(`/api/ingredients/${INCONNU}/merge`)
        .set('Cookie', jeu.a.session)
        .send({ intoId: poivre.id })
        .expect(404)
        .expect(codeDErreur('food.ingredient_not_found'));
    });

    it("refuse en 400 une fusion qui ne nomme pas l'Ingrédient conservé", async () => {
      await request(app.getHttpServer())
        .post(`/api/ingredients/${INCONNU}/merge`)
        .set('Cookie', jeu.a.session)
        .send({})
        .expect(400)
        .expect(champsEnErreur(['intoId']));
    });

    it('refuse en 401 une fusion sans session', async () => {
      await request(app.getHttpServer())
        .post(`/api/ingredients/${INCONNU}/merge`)
        .send({ intoId: INCONNU })
        .expect(401)
        .expect(codeDErreur('auth.required'));
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

  async function fusionner(
    doublon: Ingredient,
    conserve: Ingredient,
  ): Promise<Ingredient> {
    const reponse = await request(app.getHttpServer())
      .post(`/api/ingredients/${doublon.id}/merge`)
      .set('Cookie', jeu.b.session)
      .send({ intoId: conserve.id })
      .expect(200);
    return reponse.body as Ingredient;
  }

  async function rattacher(label: string, { id }: Ingredient): Promise<void> {
    await request(app.getHttpServer())
      .post('/api/ingredient-aliases')
      .set('Cookie', jeu.a.session)
      .send({ label, ingredientId: id })
      .expect(201);
  }

  async function produit(
    { id }: Ingredient,
    packageLabel: string,
    packageQuantity: number,
  ): Promise<Product> {
    const reponse = await request(app.getHttpServer())
      .post('/api/products')
      .set('Cookie', jeu.a.session)
      .send({ ingredientId: id, form: 'CANNED', packageLabel, packageQuantity })
      .expect(201);
    return reponse.body as Product;
  }

  async function preferer(
    { id }: Ingredient,
    { id: productId }: Product,
  ): Promise<void> {
    await request(app.getHttpServer())
      .post(`/api/ingredients/${id}/preferred-product`)
      .set('Cookie', jeu.a.session)
      .send({ productId })
      .expect(200);
  }

  async function preference(
    userId: string,
    kind: string,
    { id }: Ingredient,
  ): Promise<void> {
    await request(app.getHttpServer())
      .post('/api/food-preferences')
      .set('Cookie', jeu.a.session)
      .send({ userId, kind, target: 'INGREDIENT', ingredientId: id })
      .expect(201);
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
    lines: Record<string, unknown>[],
  ): Promise<Recipe> {
    const reponse = await request(app.getHttpServer())
      .post('/api/recipes')
      .set('Cookie', jeu.a.session)
      .send({ title, servings: 2, lines })
      .expect(201);
    return reponse.body as Recipe;
  }

  async function unPlanning(): Promise<MealPlan> {
    const lundi = new Date(Date.UTC(2035, 0, 1 + 7 * semaines++));
    const reponse = await request(app.getHttpServer())
      .get('/api/meal-plans')
      .query({ week: lundi.toISOString().slice(0, 10) })
      .set('Cookie', jeu.a.session)
      .expect(200);
    return reponse.body as MealPlan;
  }

  async function ajouter(
    planning: MealPlan,
    repas: Record<string, unknown>,
  ): Promise<MealPlanEntry> {
    const reponse = await request(app.getHttpServer())
      .post(`/api/meal-plans/${planning.id}/entries`)
      .set('Cookie', jeu.a.session)
      .send({
        day: planning.week,
        moment: 'DINNER',
        participantIds: [compteA, compteB],
        ...repas,
      })
      .expect(201);
    return reponse.body as MealPlanEntry;
  }

  async function cuisiner(
    repas: MealPlanEntry,
    { id }: Ingredient,
  ): Promise<void> {
    await request(app.getHttpServer())
      .post('/api/cooked-meals')
      .set('Cookie', jeu.a.session)
      .send({
        mealPlanEntryId: repas.id,
        lines: [{ ingredientId: id, quantity: 80, unit: 'G' }],
      })
      .expect(201);
  }

  async function arreter(planning: MealPlan): Promise<void> {
    await request(app.getHttpServer())
      .post(`/api/meal-plans/${planning.id}/stop`)
      .set('Cookie', jeu.a.session)
      .expect(200);
  }

  /** La liste produite du planning, par son identifiant. */
  async function produireUneListe(planning: MealPlan): Promise<string> {
    const reponse = await request(app.getHttpServer())
      .post(`/api/meal-plans/${planning.id}/shopping-lists`)
      .set('Cookie', jeu.a.session)
      .expect(201);
    return (reponse.body as { id: string }).id;
  }

  /** Ce qui cite l'Ingrédient, compté en base, modèle par modèle. */
  async function references({ id: ingredientId }: Ingredient) {
    const ou = { where: { ingredientId } };
    return {
      alias: await prisma.ingredientAlias.count(ou),
      products: await prisma.product.count(ou),
      ...(await sousPortee(SOUS_L_ESPACE_FOYER, async () => ({
        recipeLines: await prisma.recipeLine.count(ou),
        pantryItems: await prisma.pantryItem.count(ou),
        shoppingListItems: await prisma.shoppingListItem.count(ou),
        cookedMealLines: await prisma.cookedMealLine.count(ou),
        foodPreferences: await prisma.foodPreference.count(ou),
      }))),
    };
  }
});
