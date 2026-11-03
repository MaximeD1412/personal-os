import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  zApiError,
  zHousehold,
  zShoppingList,
  zShoppingListItem,
  type Ingredient,
  type MealPlan,
  type MealPlanEntry,
  type Recipe,
  type ShoppingList,
  type ShoppingListItem,
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

/** Un article exactement conforme au contrat, sans un champ de plus. */
const UN_ARTICLE = zShoppingListItem
  .extend({
    ingredient: zShoppingListItem.shape.ingredient.unwrap().strict().nullable(),
  })
  .strict();
const UNE_LISTE = zShoppingList
  .extend({
    mealPlan: zShoppingList.shape.mealPlan.unwrap().strict().nullable(),
    items: z.array(UN_ARTICLE),
  })
  .strict();

const INCONNU = '00000000-0000-4000-8000-000000000000';

/**
 * La Cuisine est à Espace unique, l'Espace foyer : il n'y a pas de 404 croisé
 * entre Espaces personnels à prouver (ADR 0030). On prouve au contraire que
 * les deux Comptes partagent les mêmes listes.
 *
 * La campagne partage sa base entre les fichiers : chaque test pose ses
 * Ingrédients et sa semaine (en 2031, qu'aucun autre fichier ne prend), et ne
 * lit des listes que celles qu'il a produites.
 */
describe('Listes de courses', () => {
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

  describe('POST /meal-plans/:id/shopping-lists', () => {
    it('consolide les besoins du planning arrêté par Ingrédient en Unité canonique, conforme au contrat', async () => {
      const farine = await ingredient('Farine (courses)', 'GRAM');
      const lait = await ingredient('Lait (courses)', 'MILLILITER');
      const crepes = await recette('Crêpes (courses)', 4, [
        { ingredientId: farine.id, quantity: 250, unit: 'G' },
        { ingredientId: lait.id, quantity: 0.5, unit: 'L' },
      ]);
      const gaufres = await recette('Gaufres (courses)', 4, [
        { ingredientId: farine.id, quantity: 0.3, unit: 'KG' },
      ]);
      const planning = await unPlanning();
      // Quatre portions : deux Participants et deux Invités.
      await ajouter(planning, 0, { recipeId: crepes.id, guestCount: 2 });
      await ajouter(planning, 1, { recipeId: gaufres.id, guestCount: 2 });
      await ajouter(planning, 2, { title: 'Restaurant' });
      await arreter(planning);

      const reponse = await request(app.getHttpServer())
        .post(`/api/meal-plans/${planning.id}/shopping-lists`)
        .set('Cookie', jeu.b.session)
        .expect(201)
        .expect(conformeA(UNE_LISTE));

      expect(reponse.body).toMatchObject({
        mealPlan: { id: planning.id, week: planning.week },
        status: 'OPEN',
        closedAt: null,
        items: [
          {
            ingredient: { id: farine.id, displayName: 'Farine (courses)' },
            label: null,
            quantity: 550,
            unit: 'GRAM',
            origin: 'PLAN',
            checked: false,
            position: 0,
          },
          {
            ingredient: { id: lait.id, displayName: 'Lait (courses)' },
            quantity: 500,
            unit: 'MILLILITER',
            origin: 'PLAN',
            position: 1,
          },
        ],
      });
    });

    it('déduit le Stock domestique : un besoin couvert ne donne pas d’article', async () => {
      const riz = await ingredient('Riz (courses)', 'GRAM');
      const sel = await ingredient('Sel (courses)', 'GRAM');
      const plat = await recette('Riz salé (courses)', 2, [
        { ingredientId: riz.id, quantity: 300, unit: 'G' },
        { ingredientId: sel.id, quantity: 5, unit: 'G' },
      ]);
      await stocker(riz.id, 100);
      await stocker(sel.id, 500);
      const planning = await unPlanning();
      await ajouter(planning, 0, { recipeId: plat.id });
      await arreter(planning);

      const liste = await produire(planning);

      expect(liste.items).toMatchObject([
        { ingredient: { id: riz.id }, quantity: 200, unit: 'GRAM' },
      ]);
    });

    it('ne change pas quand le planning change après la production, et une nouvelle production crée une autre liste', async () => {
      const pates = await ingredient('Pâtes (courses)', 'GRAM');
      const plat = await recette('Pâtes nature (courses)', 2, [
        { ingredientId: pates.id, quantity: 200, unit: 'G' },
      ]);
      const planning = await unPlanning();
      const repas = await ajouter(planning, 0, { recipeId: plat.id });
      await arreter(planning);
      const premiere = await produire(planning);

      await request(app.getHttpServer())
        .post(`/api/meal-plans/${planning.id}/reopen`)
        .set('Cookie', jeu.a.session)
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/api/meal-plans/${planning.id}/entries/${repas.id}`)
        .set('Cookie', jeu.a.session)
        .send({ guestCount: 4 })
        .expect(200);
      await arreter(planning);

      expect(await lire(premiere.id)).toEqual(premiere);

      const seconde = await produire(planning);
      expect(seconde.id).not.toBe(premiere.id);
      expect(seconde.items).toMatchObject([{ quantity: 600 }]);
      expect(await lire(premiere.id)).toEqual(premiere);
    });

    it("refuse en 422 un planning qui n'est pas arrêté", async () => {
      const planning = await unPlanning();
      await ajouter(planning, 0, { title: 'Soupe' });

      await request(app.getHttpServer())
        .post(`/api/meal-plans/${planning.id}/shopping-lists`)
        .set('Cookie', jeu.a.session)
        .expect(422)
        .expect(codeDErreur('food.plan_not_stopped'));
    });

    it('refuse en 422 une conversion impossible, nomme les Ingrédients en cause, et ne crée aucune liste', async () => {
      const huile = await ingredient('Huile (courses)', 'GRAM');
      const oeuf = await ingredient('Œuf (courses)', 'PIECE');
      const beurre = await ingredient('Beurre (courses)', 'GRAM');
      const plat = await recette('Omelette (courses)', 2, [
        { ingredientId: beurre.id, quantity: 10, unit: 'G' },
        { ingredientId: huile.id, quantity: 1, unit: 'TBSP' },
        { ingredientId: oeuf.id, quantity: 120, unit: 'G' },
      ]);
      const planning = await unPlanning();
      await ajouter(planning, 0, { recipeId: plat.id });
      await arreter(planning);
      const avant = await ouvertes();

      const reponse = await request(app.getHttpServer())
        .post(`/api/meal-plans/${planning.id}/shopping-lists`)
        .set('Cookie', jeu.a.session)
        .expect(422)
        .expect(codeDErreur('food.conversion_missing'));

      const { fields } = zApiError.parse(reponse.body);
      expect(fields).toEqual([
        {
          path: huile.id,
          code: 'dimension',
          message: expect.stringContaining('Huile (courses)'),
        },
        {
          path: oeuf.id,
          code: 'facteur_manquant',
          message: expect.stringContaining('Œuf (courses)'),
        },
      ]);
      expect(await ouvertes()).toEqual(avant);
    });

    it('refuse en 404 un planning inconnu', async () => {
      await request(app.getHttpServer())
        .post(`/api/meal-plans/${INCONNU}/shopping-lists`)
        .set('Cookie', jeu.a.session)
        .expect(404)
        .expect(codeDErreur('food.plan_not_found'));
    });

    it('refuse en 401 une production sans session', async () => {
      await request(app.getHttpServer())
        .post(`/api/meal-plans/${INCONNU}/shopping-lists`)
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('GET /shopping-lists', () => {
    it("lit les listes d'un statut, les plus récentes d'abord, partagées par le Foyer", async () => {
      const premiere = await uneListe();
      const seconde = await uneListe();

      const reponse = await request(app.getHttpServer())
        .get('/api/shopping-lists')
        .query({ status: 'OPEN' })
        .set('Cookie', jeu.b.session)
        .expect(200)
        .expect(conformeA(z.array(UNE_LISTE)));

      const ids = (reponse.body as ShoppingList[]).map(({ id }) => id);
      expect(ids.indexOf(seconde.id)).toBeGreaterThanOrEqual(0);
      expect(ids.indexOf(seconde.id)).toBeLessThan(ids.indexOf(premiere.id));

      const closes = await request(app.getHttpServer())
        .get('/api/shopping-lists')
        .query({ status: 'CLOSED' })
        .set('Cookie', jeu.a.session)
        .expect(200);
      expect((closes.body as ShoppingList[]).map(({ id }) => id)).not.toContain(
        premiere.id,
      );
    });

    it('refuse en 400 une lecture sans statut, ou un statut inconnu, sur `status`', async () => {
      await request(app.getHttpServer())
        .get('/api/shopping-lists')
        .set('Cookie', jeu.a.session)
        .expect(400)
        .expect(champsEnErreur(['status']));
      await request(app.getHttpServer())
        .get('/api/shopping-lists')
        .query({ status: 'DONE' })
        .set('Cookie', jeu.a.session)
        .expect(400)
        .expect(champsEnErreur(['status']));
    });

    it('refuse en 401 une lecture sans session', async () => {
      await request(app.getHttpServer())
        .get('/api/shopping-lists')
        .query({ status: 'OPEN' })
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('GET /shopping-lists/:id', () => {
    it('lit une liste, conforme au contrat', async () => {
      const liste = await uneListe();

      await request(app.getHttpServer())
        .get(`/api/shopping-lists/${liste.id}`)
        .set('Cookie', jeu.b.session)
        .expect(200)
        .expect(conformeA(UNE_LISTE))
        .expect(({ body }) => expect(body).toEqual(liste));
    });

    it('refuse en 404 une liste inconnue', async () => {
      await request(app.getHttpServer())
        .get(`/api/shopping-lists/${INCONNU}`)
        .set('Cookie', jeu.a.session)
        .expect(404)
        .expect(codeDErreur('food.list_not_found'));
    });

    it('refuse en 401 une lecture sans session', async () => {
      await request(app.getHttpServer())
        .get(`/api/shopping-lists/${INCONNU}`)
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('POST /shopping-lists/:id/items', () => {
    it('ajoute à la main un Ingrédient du catalogue, sa quantité en Unité canonique, après ceux du planning', async () => {
      const liste = await uneListe();
      const cafe = await ingredient('Café (courses)', 'GRAM');

      const reponse = await request(app.getHttpServer())
        .post(`/api/shopping-lists/${liste.id}/items`)
        .set('Cookie', jeu.b.session)
        .send({ ingredientId: cafe.id, quantity: 500 })
        .expect(201)
        .expect(conformeA(UN_ARTICLE));

      expect(reponse.body).toMatchObject({
        ingredient: { id: cafe.id, displayName: 'Café (courses)' },
        label: null,
        quantity: 500,
        unit: 'GRAM',
        origin: 'MANUAL',
        checked: false,
        position: liste.items.length,
      });
    });

    it('ajoute un simple libellé, avec ou sans quantité, qui se compte', async () => {
      const liste = await uneListe();

      const premier = await ajout(liste, { label: 'Liquide vaisselle' });
      const second = await ajout(liste, { label: 'Éponges', quantity: 3 });

      expect(premier).toMatchObject({
        ingredient: null,
        label: 'Liquide vaisselle',
        quantity: null,
        unit: null,
        origin: 'MANUAL',
      });
      expect(second).toMatchObject({ quantity: 3, unit: null });
      expect((await lire(liste.id)).items.slice(-2)).toEqual([premier, second]);
    });

    it('donne un rang distinct à des ajouts simultanés', async () => {
      const liste = await uneListe();

      const ajouts = await Promise.all(
        ['Sel', 'Poivre', 'Sucre', 'Thé'].map((label) =>
          ajout(liste, { label }),
        ),
      );

      expect(new Set(ajouts.map(({ position }) => position)).size).toBe(4);
    });

    it('refuse en 400 un Ingrédient et un libellé à la fois, sur `label`', async () => {
      const liste = await uneListe();

      await request(app.getHttpServer())
        .post(`/api/shopping-lists/${liste.id}/items`)
        .set('Cookie', jeu.a.session)
        .send({ ingredientId: INCONNU, label: 'Farine' })
        .expect(400)
        .expect(champsEnErreur(['label']));
    });

    it('refuse en 422 un Ingrédient absent du catalogue', async () => {
      const liste = await uneListe();

      await request(app.getHttpServer())
        .post(`/api/shopping-lists/${liste.id}/items`)
        .set('Cookie', jeu.a.session)
        .send({ ingredientId: INCONNU })
        .expect(422)
        .expect(codeDErreur('food.unknown_ingredient'));
    });

    it('refuse en 422 un ajout à une liste close', async () => {
      const liste = await uneListe();
      await clore(liste);

      await request(app.getHttpServer())
        .post(`/api/shopping-lists/${liste.id}/items`)
        .set('Cookie', jeu.a.session)
        .send({ label: 'Sacs' })
        .expect(422)
        .expect(codeDErreur('food.list_already_closed'));
    });

    it('refuse en 404 une liste inconnue', async () => {
      await request(app.getHttpServer())
        .post(`/api/shopping-lists/${INCONNU}/items`)
        .set('Cookie', jeu.a.session)
        .send({ label: 'Sacs' })
        .expect(404)
        .expect(codeDErreur('food.list_not_found'));
    });

    it('refuse en 401 un ajout sans session', async () => {
      await request(app.getHttpServer())
        .post(`/api/shopping-lists/${INCONNU}/items`)
        .send({ label: 'Sacs' })
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('POST /shopping-lists/:id/items/:itemId/check et /uncheck', () => {
    it('coche puis décoche un article, sans rien changer d’autre', async () => {
      const liste = await uneListe();
      const [article] = liste.items;

      await request(app.getHttpServer())
        .post(`/api/shopping-lists/${liste.id}/items/${article.id}/check`)
        .set('Cookie', jeu.a.session)
        .expect(200)
        .expect(conformeA(UN_ARTICLE))
        .expect(({ body }) =>
          expect(body).toEqual({ ...article, checked: true }),
        );
      // Cocher deux fois ne change rien.
      await request(app.getHttpServer())
        .post(`/api/shopping-lists/${liste.id}/items/${article.id}/check`)
        .set('Cookie', jeu.b.session)
        .expect(200);
      expect((await lire(liste.id)).items[0]).toEqual({
        ...article,
        checked: true,
      });

      await request(app.getHttpServer())
        .post(`/api/shopping-lists/${liste.id}/items/${article.id}/uncheck`)
        .set('Cookie', jeu.b.session)
        .expect(200)
        .expect(conformeA(UN_ARTICLE))
        .expect(({ body }) => expect(body).toEqual(article));
    });

    it("refuse en 404 l'article d'une autre liste", async () => {
      const liste = await uneListe();
      const autre = await uneListe();

      for (const action of ['check', 'uncheck']) {
        await request(app.getHttpServer())
          .post(
            `/api/shopping-lists/${liste.id}/items/${autre.items[0].id}/${action}`,
          )
          .set('Cookie', jeu.a.session)
          .expect(404)
          .expect(codeDErreur('food.item_not_found'));
      }
    });

    it('refuse en 422 de cocher sur une liste close', async () => {
      const liste = await uneListe();
      await clore(liste);

      await request(app.getHttpServer())
        .post(
          `/api/shopping-lists/${liste.id}/items/${liste.items[0].id}/check`,
        )
        .set('Cookie', jeu.a.session)
        .expect(422)
        .expect(codeDErreur('food.list_already_closed'));
    });

    it('refuse en 422 de décocher sur une liste close, et l’article reste coché', async () => {
      const liste = await uneListe();
      const [article] = liste.items;
      await request(app.getHttpServer())
        .post(`/api/shopping-lists/${liste.id}/items/${article.id}/check`)
        .set('Cookie', jeu.a.session)
        .expect(200);
      await clore(liste);

      await request(app.getHttpServer())
        .post(`/api/shopping-lists/${liste.id}/items/${article.id}/uncheck`)
        .set('Cookie', jeu.a.session)
        .expect(422)
        .expect(codeDErreur('food.list_already_closed'));
      expect((await lire(liste.id)).items[0]).toEqual({
        ...article,
        checked: true,
      });
    });

    it('refuse en 401 un cochage sans session', async () => {
      for (const action of ['check', 'uncheck']) {
        await request(app.getHttpServer())
          .post(`/api/shopping-lists/${INCONNU}/items/${INCONNU}/${action}`)
          .expect(401)
          .expect(codeDErreur('auth.required'));
      }
    });
  });

  describe('DELETE /shopping-lists/:id/items/:itemId', () => {
    it('retire un ajout manuel', async () => {
      const liste = await uneListe();
      const article = await ajout(liste, { label: 'Essuie-tout' });

      await request(app.getHttpServer())
        .delete(`/api/shopping-lists/${liste.id}/items/${article.id}`)
        .set('Cookie', jeu.b.session)
        .expect(204);

      expect((await lire(liste.id)).items).toEqual(liste.items);
    });

    it('refuse en 422 de retirer un article du planning', async () => {
      const liste = await uneListe();

      await request(app.getHttpServer())
        .delete(`/api/shopping-lists/${liste.id}/items/${liste.items[0].id}`)
        .set('Cookie', jeu.a.session)
        .expect(422)
        .expect(codeDErreur('food.item_not_manual'));
      expect(await lire(liste.id)).toEqual(liste);
    });

    it('refuse en 422 de retirer un ajout manuel d’une liste close, qui le garde', async () => {
      const liste = await uneListe();
      const article = await ajout(liste, { label: 'Essuie-tout' });
      await clore(liste);

      await request(app.getHttpServer())
        .delete(`/api/shopping-lists/${liste.id}/items/${article.id}`)
        .set('Cookie', jeu.a.session)
        .expect(422)
        .expect(codeDErreur('food.list_already_closed'));
      expect((await lire(liste.id)).items).toEqual([...liste.items, article]);
    });

    it('refuse en 404 un article inconnu', async () => {
      const liste = await uneListe();

      await request(app.getHttpServer())
        .delete(`/api/shopping-lists/${liste.id}/items/${INCONNU}`)
        .set('Cookie', jeu.a.session)
        .expect(404)
        .expect(codeDErreur('food.item_not_found'));
    });

    it('refuse en 401 un retrait sans session', async () => {
      await request(app.getHttpServer())
        .delete(`/api/shopping-lists/${INCONNU}/items/${INCONNU}`)
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  /** Une semaine de 2031 que ce fichier n'a pas encore prise. */
  async function unPlanning(): Promise<MealPlan> {
    const lundi = new Date(Date.UTC(2031, 0, 6 + 7 * semaines++));
    const reponse = await request(app.getHttpServer())
      .get('/api/meal-plans')
      .query({ week: lundi.toISOString().slice(0, 10) })
      .set('Cookie', jeu.a.session)
      .expect(200);
    return reponse.body as MealPlan;
  }

  /** Un repas pour les deux Comptes, le `jour`-ième jour de la semaine. */
  async function ajouter(
    planning: MealPlan,
    jour: number,
    repas: Record<string, unknown>,
  ): Promise<MealPlanEntry> {
    const day = new Date(`${planning.week}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() + jour);
    const reponse = await request(app.getHttpServer())
      .post(`/api/meal-plans/${planning.id}/entries`)
      .set('Cookie', jeu.a.session)
      .send({
        day: day.toISOString().slice(0, 10),
        moment: 'DINNER',
        participantIds: [compteA, compteB],
        ...repas,
      })
      .expect(201);
    return reponse.body as MealPlanEntry;
  }

  async function arreter(planning: MealPlan): Promise<void> {
    await request(app.getHttpServer())
      .post(`/api/meal-plans/${planning.id}/stop`)
      .set('Cookie', jeu.a.session)
      .expect(200);
  }

  async function produire(planning: MealPlan): Promise<ShoppingList> {
    const reponse = await request(app.getHttpServer())
      .post(`/api/meal-plans/${planning.id}/shopping-lists`)
      .set('Cookie', jeu.a.session)
      .expect(201);
    return reponse.body as ShoppingList;
  }

  /** Une liste ouverte de deux articles du planning. */
  async function uneListe(): Promise<ShoppingList> {
    const tomates = await ingredient(`Tomates ${semaines} (courses)`, 'GRAM');
    const oignons = await ingredient(`Oignons ${semaines} (courses)`, 'PIECE');
    const plat = await recette(`Sauce ${semaines} (courses)`, 2, [
      { ingredientId: tomates.id, quantity: 400, unit: 'G' },
      { ingredientId: oignons.id, quantity: 1, unit: 'PIECE' },
    ]);
    const planning = await unPlanning();
    await ajouter(planning, 0, { recipeId: plat.id });
    await arreter(planning);
    return produire(planning);
  }

  async function lire(id: string): Promise<ShoppingList> {
    const reponse = await request(app.getHttpServer())
      .get(`/api/shopping-lists/${id}`)
      .set('Cookie', jeu.a.session)
      .expect(200);
    return reponse.body as ShoppingList;
  }

  async function ouvertes(): Promise<string[]> {
    const reponse = await request(app.getHttpServer())
      .get('/api/shopping-lists')
      .query({ status: 'OPEN' })
      .set('Cookie', jeu.a.session)
      .expect(200);
    return (reponse.body as ShoppingList[]).map(({ id }) => id);
  }

  async function ajout(
    liste: ShoppingList,
    saisie: Record<string, unknown>,
  ): Promise<ShoppingListItem> {
    const reponse = await request(app.getHttpServer())
      .post(`/api/shopping-lists/${liste.id}/items`)
      .set('Cookie', jeu.a.session)
      .send(saisie)
      .expect(201);
    return reponse.body as ShoppingListItem;
  }

  /** La clôture vient avec CUISINE-10 : on la pose en base. */
  async function clore(liste: ShoppingList): Promise<void> {
    await sousPortee(
      {
        espaces: [{ id: jeu.espaceFoyer, kind: 'HOUSEHOLD' }],
        typesAcceptes: ['HOUSEHOLD'],
      },
      async () =>
        await prisma.shoppingList.update({
          where: { id: liste.id },
          data: { status: 'CLOSED', closedAt: new Date() },
        }),
    );
  }

  async function stocker(
    ingredientId: string,
    quantity: number,
  ): Promise<void> {
    await request(app.getHttpServer())
      .put(`/api/pantry-items/${ingredientId}`)
      .set('Cookie', jeu.a.session)
      .send({ quantity })
      .expect(200);
  }

  async function recette(
    title: string,
    servings: number,
    lines: { ingredientId: string; quantity: number; unit: string }[],
  ): Promise<Recipe> {
    const reponse = await request(app.getHttpServer())
      .post('/api/recipes')
      .set('Cookie', jeu.a.session)
      .send({ title, servings, lines })
      .expect(201);
    return reponse.body as Recipe;
  }

  async function ingredient(
    displayName: string,
    canonicalUnit: string,
  ): Promise<Ingredient> {
    const reponse = await request(app.getHttpServer())
      .post('/api/ingredients')
      .set('Cookie', jeu.a.session)
      .send({ displayName, canonicalUnit })
      .expect(201);
    return reponse.body as Ingredient;
  }
});
