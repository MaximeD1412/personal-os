import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  zIngredient,
  zProduct,
  type Ingredient,
  type Product,
} from '@personal-os/contracts';
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

const REDIRECT_URI = 'http://app.exemple.test/api/auth/callback';
const DASHBOARD_URL = 'http://app.exemple.test/';
const ADRESSE_A = 'a@exemple.test';
const ADRESSE_B = 'b@exemple.test';

const UN_PRODUIT = zProduct.strict();
const DES_PRODUITS = z.array(zProduct.strict());
const UN_INGREDIENT = zIngredient.strict();

const INCONNU = '00000000-0000-4000-8000-000000000000';

/**
 * Les Produits sont hors Espace, comme le catalogue d'Ingrédients qu'ils
 * déclinent : pas de 404 croisé à prouver (ADR 0030), mais les deux Comptes
 * partagent le même catalogue.
 *
 * La campagne partage sa base entre les fichiers : chaque test nomme ses
 * Ingrédients d'un libellé qui lui est propre.
 */
describe('Produits', () => {
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

  describe('POST /products', () => {
    it('crée un Produit conforme au contrat, sans marque par défaut', async () => {
      const tomate = await ingredient('Tomate concassée produit-creer');

      const reponse = await request(app.getHttpServer())
        .post('/api/products')
        .set('Cookie', jeu.a.session)
        .send({
          ingredientId: tomate.id,
          form: 'CANNED',
          packageQuantity: 400,
          packageLabel: '  boîte ',
        })
        .expect(201)
        .expect(conformeA(UN_PRODUIT));

      expect(reponse.body).toMatchObject({
        ingredientId: tomate.id,
        brand: null,
        form: 'CANNED',
        packageQuantity: 400,
        packageLabel: 'boîte',
      });
    });

    it('garde la contenance au millième près', async () => {
      const huile = await ingredient('Huile produit-millieme', 'MILLILITER');

      const produit = await creer(jeu.a, {
        ingredientId: huile.id,
        brand: 'Puget',
        form: 'OTHER',
        packageQuantity: 750.125,
        packageLabel: 'bouteille',
      });

      expect(produit.packageQuantity).toBe(750.125);
      expect(produit.brand).toBe('Puget');
    });

    it('refuse en 400 une contenance nulle, en pointant le champ', async () => {
      const riz = await ingredient('Riz produit-400');

      await request(app.getHttpServer())
        .post('/api/products')
        .set('Cookie', jeu.a.session)
        .send({
          ingredientId: riz.id,
          form: 'DRY',
          packageQuantity: 0,
          packageLabel: 'paquet',
        })
        .expect(400)
        .expect(champsEnErreur(['packageQuantity']));
    });

    it('refuse en 422 un Ingrédient inconnu', async () => {
      await request(app.getHttpServer())
        .post('/api/products')
        .set('Cookie', jeu.a.session)
        .send({
          ingredientId: INCONNU,
          form: 'DRY',
          packageQuantity: 500,
          packageLabel: 'paquet',
        })
        .expect(422)
        .expect(codeDErreur('food.unknown_ingredient'));
    });

    it('refuse en 401 une création sans session', async () => {
      await request(app.getHttpServer())
        .post('/api/products')
        .send({})
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('GET /ingredients/:id/products', () => {
    it("liste les Produits d'un Ingrédient, dans leur ordre de création, pour les deux Comptes", async () => {
      const pates = await ingredient('Pâtes produit-lister');
      const autre = await ingredient('Lentilles produit-lister');
      const premier = await creer(jeu.a, {
        ingredientId: pates.id,
        form: 'DRY',
        packageQuantity: 500,
        packageLabel: 'paquet',
      });
      const second = await creer(jeu.b, {
        ingredientId: pates.id,
        brand: 'Barilla',
        form: 'DRY',
        packageQuantity: 1000,
        packageLabel: 'paquet',
      });
      await creer(jeu.a, {
        ingredientId: autre.id,
        form: 'DRY',
        packageQuantity: 500,
        packageLabel: 'sachet',
      });

      const reponse = await request(app.getHttpServer())
        .get(`/api/ingredients/${pates.id}/products`)
        .set('Cookie', jeu.b.session)
        .expect(200)
        .expect(conformeA(DES_PRODUITS));

      expect((reponse.body as Product[]).map(({ id }) => id)).toEqual([
        premier.id,
        second.id,
      ]);
    });

    it('répond 404 pour un Ingrédient inconnu', async () => {
      await request(app.getHttpServer())
        .get(`/api/ingredients/${INCONNU}/products`)
        .set('Cookie', jeu.a.session)
        .expect(404)
        .expect(codeDErreur('food.ingredient_not_found'));
    });

    it('refuse en 401 une lecture sans session', async () => {
      await request(app.getHttpServer())
        .get(`/api/ingredients/${INCONNU}/products`)
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('PATCH /products/:id', () => {
    it('ne change que ce que la modification porte', async () => {
      const mais = await ingredient('Maïs produit-modifier');
      const produit = await creer(jeu.a, {
        ingredientId: mais.id,
        brand: 'Géant Vert',
        form: 'CANNED',
        packageQuantity: 285,
        packageLabel: 'boîte',
      });

      const reponse = await request(app.getHttpServer())
        .patch(`/api/products/${produit.id}`)
        .set('Cookie', jeu.b.session)
        .send({ packageQuantity: 300, brand: null })
        .expect(200)
        .expect(conformeA(UN_PRODUIT));

      expect(reponse.body).toEqual({
        ...produit,
        packageQuantity: 300,
        brand: null,
      });
    });

    it('refuse en 400 un conditionnement vide, en pointant le champ', async () => {
      const pois = await ingredient('Pois produit-400');
      const produit = await creer(jeu.a, {
        ingredientId: pois.id,
        form: 'FROZEN',
        packageQuantity: 1000,
        packageLabel: 'sachet',
      });

      await request(app.getHttpServer())
        .patch(`/api/products/${produit.id}`)
        .set('Cookie', jeu.a.session)
        .send({ packageLabel: '   ' })
        .expect(400)
        .expect(champsEnErreur(['packageLabel']));
    });

    it('refuse en 422 une modification vide', async () => {
      const thon = await ingredient('Thon produit-vide');
      const produit = await creer(jeu.a, {
        ingredientId: thon.id,
        form: 'CANNED',
        packageQuantity: 140,
        packageLabel: 'boîte',
      });

      await request(app.getHttpServer())
        .patch(`/api/products/${produit.id}`)
        .set('Cookie', jeu.a.session)
        .send({})
        .expect(422)
        .expect(codeDErreur('food.product_empty_update'));
    });

    it('répond 404 pour un Produit inconnu', async () => {
      await request(app.getHttpServer())
        .patch(`/api/products/${INCONNU}`)
        .set('Cookie', jeu.a.session)
        .send({ packageQuantity: 10 })
        .expect(404)
        .expect(codeDErreur('food.product_not_found'));
    });

    it('refuse en 401 une modification sans session', async () => {
      await request(app.getHttpServer())
        .patch(`/api/products/${INCONNU}`)
        .send({ packageQuantity: 10 })
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('DELETE /products/:id', () => {
    it("retire le Produit, et le Produit préféré de l'Ingrédient avec lui", async () => {
      const farine = await ingredient('Farine produit-retirer');
      const produit = await creer(jeu.a, {
        ingredientId: farine.id,
        form: 'DRY',
        packageQuantity: 1000,
        packageLabel: 'paquet',
      });
      await preferer(jeu.a, farine.id, produit.id).expect(200);

      await request(app.getHttpServer())
        .delete(`/api/products/${produit.id}`)
        .set('Cookie', jeu.b.session)
        .expect(204);

      const relue = await request(app.getHttpServer())
        .get(`/api/ingredients/${farine.id}`)
        .set('Cookie', jeu.a.session)
        .expect(200);
      expect((relue.body as Ingredient).preferredProductId).toBeNull();

      const liste = await request(app.getHttpServer())
        .get(`/api/ingredients/${farine.id}/products`)
        .set('Cookie', jeu.a.session)
        .expect(200);
      expect(liste.body).toEqual([]);
    });

    it('répond 404 pour un Produit inconnu', async () => {
      await request(app.getHttpServer())
        .delete(`/api/products/${INCONNU}`)
        .set('Cookie', jeu.a.session)
        .expect(404)
        .expect(codeDErreur('food.product_not_found'));
    });

    it('refuse en 401 un retrait sans session', async () => {
      await request(app.getHttpServer())
        .delete(`/api/products/${INCONNU}`)
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('POST /ingredients/:id/preferred-product', () => {
    it("fait d'un Produit le préféré de son Ingrédient, puis le retire", async () => {
      const lait = await ingredient('Lait produit-preferer', 'MILLILITER');
      const produit = await creer(jeu.a, {
        ingredientId: lait.id,
        form: 'FRESH',
        packageQuantity: 1000,
        packageLabel: 'brique',
      });

      const choisi = await preferer(jeu.a, lait.id, produit.id)
        .expect(200)
        .expect(conformeA(UN_INGREDIENT));
      expect((choisi.body as Ingredient).preferredProductId).toBe(produit.id);

      const retire = await preferer(jeu.b, lait.id, null).expect(200);
      expect((retire.body as Ingredient).preferredProductId).toBeNull();
    });

    it("refuse en 422 le Produit d'un autre Ingrédient", async () => {
      const beurre = await ingredient('Beurre produit-etranger');
      const creme = await ingredient('Crème produit-etranger');
      const produit = await creer(jeu.a, {
        ingredientId: creme.id,
        form: 'FRESH',
        packageQuantity: 200,
        packageLabel: 'pot',
      });

      await preferer(jeu.a, beurre.id, produit.id)
        .expect(422)
        .expect(codeDErreur('food.product_not_of_ingredient'));
    });

    it('refuse en 422 un Produit inconnu', async () => {
      const sucre = await ingredient('Sucre produit-inconnu');

      await preferer(jeu.a, sucre.id, INCONNU)
        .expect(422)
        .expect(codeDErreur('food.product_not_of_ingredient'));
    });

    it('refuse en 400 un choix absent, en pointant le champ', async () => {
      const sel = await ingredient('Sel produit-400');

      await request(app.getHttpServer())
        .post(`/api/ingredients/${sel.id}/preferred-product`)
        .set('Cookie', jeu.a.session)
        .send({})
        .expect(400)
        .expect(champsEnErreur(['productId']));
    });

    it('répond 404 pour un Ingrédient inconnu', async () => {
      await preferer(jeu.a, INCONNU, null)
        .expect(404)
        .expect(codeDErreur('food.ingredient_not_found'));
    });

    it('refuse en 401 un choix sans session', async () => {
      await request(app.getHttpServer())
        .post(`/api/ingredients/${INCONNU}/preferred-product`)
        .send({ productId: null })
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe("L'Unité canonique d'un Ingrédient qui a des Produits", () => {
    it('ne change pas, en 422', async () => {
      const oignon = await ingredient('Oignon produit-unite');
      await creer(jeu.a, {
        ingredientId: oignon.id,
        form: 'FROZEN',
        packageQuantity: 750,
        packageLabel: 'sachet',
      });

      await request(app.getHttpServer())
        .patch(`/api/ingredients/${oignon.id}`)
        .set('Cookie', jeu.a.session)
        .send({ canonicalUnit: 'PIECE' })
        .expect(422)
        .expect(codeDErreur('food.ingredient_unit_has_products'));
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

  async function creer(
    compte: CompteDeTest,
    saisie: Record<string, unknown>,
  ): Promise<Product> {
    const reponse = await request(app.getHttpServer())
      .post('/api/products')
      .set('Cookie', compte.session)
      .send(saisie)
      .expect(201);
    return reponse.body as Product;
  }

  function preferer(
    compte: CompteDeTest,
    ingredientId: string,
    productId: string | null,
  ) {
    return request(app.getHttpServer())
      .post(`/api/ingredients/${ingredientId}/preferred-product`)
      .set('Cookie', compte.session)
      .send({ productId });
  }
});
