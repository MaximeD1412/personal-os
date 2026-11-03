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
  type PantryItem,
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
import { ShoppingListRepository } from './shopping-list.repository';

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

  describe('POST /shopping-lists/:id/close', () => {
    it('monte au stock les quantités achetées des articles cochés, puis clôt la liste, conforme au contrat', async () => {
      const liste = await uneListe();
      const [oignons, tomates] = liste.items;
      const riz = await ingredient(`Riz ${semaines} (courses)`, 'GRAM');
      const ajoutDeRiz = await ajout(liste, {
        ingredientId: riz.id,
        quantity: 1000,
      });
      const sacs = await ajout(liste, { label: 'Sacs', quantity: 2 });
      await stocker(idDe(tomates), 100);
      for (const article of [tomates, ajoutDeRiz, sacs]) {
        await cocher(liste, article);
      }

      const reponse = await request(app.getHttpServer())
        .post(`/api/shopping-lists/${liste.id}/close`)
        .set('Cookie', jeu.b.session)
        .send({ items: [{ itemId: tomates.id, purchasedQuantity: 500 }] })
        .expect(200)
        .expect(conformeA(UNE_LISTE));

      expect(reponse.body).toMatchObject({
        id: liste.id,
        status: 'CLOSED',
        closedAt: expect.any(String),
      });
      expect(await lire(liste.id)).toMatchObject({ status: 'CLOSED' });
      // Les tomates montent de ce qu'on a acheté, pas des 400 g de la liste ;
      // le riz de sa quantité de liste ; les oignons non cochés n'entrent pas.
      expect(await stockDe([idDe(oignons), idDe(tomates), riz.id])).toEqual({
        [idDe(tomates)]: { quantity: 600, expiresOn: null },
        [riz.id]: { quantity: 1000, expiresOn: null },
      });
    });

    it('pose la péremption donnée à un périssable, et garde la plus proche au rachat', async () => {
      const liste = await uneListe();
      const yaourts = await ingredient(
        `Yaourts ${semaines} (courses)`,
        'PIECE',
        true,
      );
      const article = await ajout(liste, {
        ingredientId: yaourts.id,
        quantity: 4,
      });
      await cocher(liste, article);
      await request(app.getHttpServer())
        .put(`/api/pantry-items/${yaourts.id}`)
        .set('Cookie', jeu.a.session)
        .send({ quantity: 2, expiresOn: '2031-03-20' })
        .expect(200);

      await request(app.getHttpServer())
        .post(`/api/shopping-lists/${liste.id}/close`)
        .set('Cookie', jeu.a.session)
        .send({ items: [{ itemId: article.id, expiresOn: '2031-03-12' }] })
        .expect(200);

      expect(await stockDe([yaourts.id])).toEqual({
        [yaourts.id]: { quantity: 6, expiresOn: '2031-03-12' },
      });
    });

    it('additionne deux articles du même Ingrédient sur sa seule ligne de stock', async () => {
      const liste = await uneListe();
      const [, tomates] = liste.items;
      const encore = await ajout(liste, {
        ingredientId: idDe(tomates),
        quantity: 250,
      });
      await cocher(liste, tomates);
      await cocher(liste, encore);

      await request(app.getHttpServer())
        .post(`/api/shopping-lists/${liste.id}/close`)
        .set('Cookie', jeu.a.session)
        .send({ items: [] })
        .expect(200);

      expect(await stockDe([idDe(tomates)])).toEqual({
        [idDe(tomates)]: { quantity: 650, expiresOn: null },
      });
    });

    it('refuse en 422 un périssable coché sans péremption, nomme les articles en cause, et ne touche à rien', async () => {
      const liste = await uneListe();
      const [, tomates] = liste.items;
      const yaourts = await ingredient(
        `Yaourts ${semaines} bis (courses)`,
        'PIECE',
        true,
      );
      const article = await ajout(liste, {
        ingredientId: yaourts.id,
        quantity: 4,
      });
      // Un périssable non coché n'est pas acheté : il ne demande rien.
      await ajout(liste, { ingredientId: yaourts.id, quantity: 1 });
      await cocher(liste, tomates);
      await cocher(liste, article);

      const reponse = await request(app.getHttpServer())
        .post(`/api/shopping-lists/${liste.id}/close`)
        .set('Cookie', jeu.a.session)
        .send({ items: [{ itemId: article.id, purchasedQuantity: 6 }] })
        .expect(422)
        .expect(codeDErreur('food.expiry_required'));

      expect(reponse.body.fields).toEqual([
        {
          path: article.id,
          code: 'expiry_required',
          message: expect.stringContaining(yaourts.displayName),
        },
      ]);
      expect(await lire(liste.id)).toMatchObject({
        status: 'OPEN',
        closedAt: null,
      });
      expect(await stockDe([idDe(tomates), yaourts.id])).toEqual({});
    });

    it("refuse en 422 un article coché sans quantité de liste, si l'on n'en donne pas d'achetée", async () => {
      const liste = await uneListe();
      const sel = await ingredient(`Sel ${semaines} (courses)`, 'GRAM');
      const article = await ajout(liste, { ingredientId: sel.id });
      await cocher(liste, article);

      const reponse = await request(app.getHttpServer())
        .post(`/api/shopping-lists/${liste.id}/close`)
        .set('Cookie', jeu.a.session)
        .send({ items: [] })
        .expect(422)
        .expect(codeDErreur('food.purchased_quantity_required'));
      expect(reponse.body.fields).toEqual([
        expect.objectContaining({ path: article.id }),
      ]);

      await request(app.getHttpServer())
        .post(`/api/shopping-lists/${liste.id}/close`)
        .set('Cookie', jeu.a.session)
        .send({ items: [{ itemId: article.id, purchasedQuantity: 500 }] })
        .expect(200);
      expect(await stockDe([sel.id])).toEqual({
        [sel.id]: { quantity: 500, expiresOn: null },
      });
    });

    it('refuse en 422 une liste déjà close, sans monter le stock une seconde fois', async () => {
      const liste = await uneListe();
      const [, tomates] = liste.items;
      await cocher(liste, tomates);
      await request(app.getHttpServer())
        .post(`/api/shopping-lists/${liste.id}/close`)
        .set('Cookie', jeu.a.session)
        .send({ items: [] })
        .expect(200);

      await request(app.getHttpServer())
        .post(`/api/shopping-lists/${liste.id}/close`)
        .set('Cookie', jeu.b.session)
        .send({ items: [] })
        .expect(422)
        .expect(codeDErreur('food.list_closed'));
      expect(await stockDe([idDe(tomates)])).toEqual({
        [idDe(tomates)]: { quantity: 400, expiresOn: null },
      });
    });

    it('ne monte le stock qu’une fois pour deux clôtures simultanées', async () => {
      const liste = await uneListe();
      const [, tomates] = liste.items;
      await cocher(liste, tomates);

      const statuts = await Promise.all(
        [jeu.a.session, jeu.b.session].map(
          async (session) =>
            (
              await request(app.getHttpServer())
                .post(`/api/shopping-lists/${liste.id}/close`)
                .set('Cookie', session)
                .send({ items: [] })
            ).status,
        ),
      );

      expect(statuts.sort()).toEqual([200, 422]);
      expect(await stockDe([idDe(tomates)])).toEqual({
        [idDe(tomates)]: { quantity: 400, expiresOn: null },
      });
    });

    // Une autre session ajoute et coche un article entre la lecture de la liste
    // et sa clôture : la clôture recommence sur la liste relue.
    async function cloturerApresUnAjout(
      liste: ShoppingList,
      saisie: Record<string, unknown>,
    ) {
      const original = ShoppingListRepository.prototype.lignesDeStock;
      const depot = app.get(ShoppingListRepository);
      const lecture = jest
        .spyOn(depot, 'lignesDeStock')
        .mockImplementationOnce(async (ids) => {
          await cocher(liste, await ajout(liste, saisie));
          return original.call(depot, ids);
        });
      try {
        return await request(app.getHttpServer())
          .post(`/api/shopping-lists/${liste.id}/close`)
          .set('Cookie', jeu.a.session)
          .send({ items: [] });
      } finally {
        lecture.mockRestore();
      }
    }

    it('monte au stock un article ajouté et coché pendant la clôture', async () => {
      const liste = await uneListe();
      const [, tomates] = liste.items;
      await cocher(liste, tomates);
      const riz = await ingredient(`Riz ${semaines} tard (courses)`, 'GRAM');

      const reponse = await cloturerApresUnAjout(liste, {
        ingredientId: riz.id,
        quantity: 300,
      });

      expect(reponse.status).toBe(200);
      expect(reponse.body.items).toHaveLength(liste.items.length + 1);
      expect(await stockDe([idDe(tomates), riz.id])).toEqual({
        [idDe(tomates)]: { quantity: 400, expiresOn: null },
        [riz.id]: { quantity: 300, expiresOn: null },
      });
    });

    it('refuse en 422 un périssable ajouté et coché pendant la clôture, sans sa péremption', async () => {
      const liste = await uneListe();
      const [, tomates] = liste.items;
      await cocher(liste, tomates);
      const creme = await ingredient(
        `Crème ${semaines} tard (courses)`,
        'MILLILITER',
        true,
      );

      const reponse = await cloturerApresUnAjout(liste, {
        ingredientId: creme.id,
        quantity: 200,
      });

      expect(reponse.status).toBe(422);
      expect(reponse.body.code).toBe('food.expiry_required');
      expect(await lire(liste.id)).toMatchObject({ status: 'OPEN' });
      expect(await stockDe([idDe(tomates), creme.id])).toEqual({});
    });

    it('rend une liste close aux autres gestes : on ne coche plus', async () => {
      const liste = await uneListe();
      await request(app.getHttpServer())
        .post(`/api/shopping-lists/${liste.id}/close`)
        .set('Cookie', jeu.a.session)
        .send({ items: [] })
        .expect(200);

      await request(app.getHttpServer())
        .post(
          `/api/shopping-lists/${liste.id}/items/${liste.items[0].id}/check`,
        )
        .set('Cookie', jeu.a.session)
        .expect(422)
        .expect(codeDErreur('food.list_already_closed'));
    });

    it('refuse en 400 une quantité achetée nulle, sur `items.0.purchasedQuantity`', async () => {
      const liste = await uneListe();

      await request(app.getHttpServer())
        .post(`/api/shopping-lists/${liste.id}/close`)
        .set('Cookie', jeu.a.session)
        .send({ items: [{ itemId: liste.items[0].id, purchasedQuantity: 0 }] })
        .expect(400)
        .expect(champsEnErreur(['items.0.purchasedQuantity']));
    });

    it("refuse en 404 un article qui n'est pas de la liste", async () => {
      const liste = await uneListe();

      await request(app.getHttpServer())
        .post(`/api/shopping-lists/${liste.id}/close`)
        .set('Cookie', jeu.a.session)
        .send({ items: [{ itemId: INCONNU }] })
        .expect(404)
        .expect(codeDErreur('food.item_not_found'));
      expect(await lire(liste.id)).toMatchObject({ status: 'OPEN' });
    });

    it('refuse en 404 une liste inconnue', async () => {
      await request(app.getHttpServer())
        .post(`/api/shopping-lists/${INCONNU}/close`)
        .set('Cookie', jeu.a.session)
        .send({ items: [] })
        .expect(404)
        .expect(codeDErreur('food.list_not_found'));
    });

    it('refuse en 401 une clôture sans session', async () => {
      await request(app.getHttpServer())
        .post(`/api/shopping-lists/${INCONNU}/close`)
        .send({ items: [] })
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

  function idDe(article: ShoppingListItem): string {
    return article.ingredient?.id ?? '';
  }

  async function cocher(
    liste: ShoppingList,
    article: ShoppingListItem,
  ): Promise<void> {
    await request(app.getHttpServer())
      .post(`/api/shopping-lists/${liste.id}/items/${article.id}/check`)
      .set('Cookie', jeu.a.session)
      .expect(200);
  }

  /** Les lignes de stock de ces Ingrédients, par Ingrédient. */
  async function stockDe(
    ids: string[],
  ): Promise<Record<string, { quantity: number; expiresOn: string | null }>> {
    const reponse = await request(app.getHttpServer())
      .get('/api/pantry-items')
      .set('Cookie', jeu.a.session)
      .expect(200);
    return Object.fromEntries(
      (reponse.body as PantryItem[])
        .filter(({ ingredient }) => ids.includes(ingredient.id))
        .map(({ ingredient, quantity, expiresOn }) => [
          ingredient.id,
          { quantity, expiresOn },
        ]),
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
    perishable = false,
  ): Promise<Ingredient> {
    const reponse = await request(app.getHttpServer())
      .post('/api/ingredients')
      .set('Cookie', jeu.a.session)
      .send({ displayName, canonicalUnit, perishable })
      .expect(201);
    return reponse.body as Ingredient;
  }
});
