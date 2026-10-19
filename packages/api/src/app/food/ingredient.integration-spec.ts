import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { zIngredient, type Ingredient } from '@personal-os/contracts';
import { PrismaService } from '@personal-os/database';
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

/** Un Ingrédient exactement conforme au contrat, sans un champ de plus. */
const UN_INGREDIENT = zIngredient.strict();
const DES_INGREDIENTS = z.array(zIngredient.strict());

const INCONNU = '00000000-0000-4000-8000-000000000000';

/**
 * Le catalogue est global : `Ingredient` est hors Espace. Il n'y a donc pas de
 * 404 croisé à prouver (ADR 0030) ; on prouve au contraire que les deux
 * Comptes voient et modifient le même catalogue.
 *
 * La campagne partage sa base entre les fichiers : chaque test nomme ses
 * Ingrédients d'un libellé qui lui est propre.
 */
describe("Catalogue d'Ingrédients", () => {
  let authentik: FauxAuthentik;
  let app: INestApplication;
  let jeu: JeuDEspaces;
  let prisma: PrismaService;

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
  });

  afterAll(async () => {
    await app?.close();
    await authentik?.close();
  });

  describe('POST /ingredients', () => {
    it('crée un Ingrédient, nommé par son libellé normalisé, conforme au contrat', async () => {
      const reponse = await request(app.getHttpServer())
        .post('/api/ingredients')
        .set('Cookie', jeu.a.session)
        .send({
          displayName: '  Crème fraîche épaisse ',
          canonicalUnit: 'GRAM',
          allergens: ['MILK'],
          perishable: true,
        })
        .expect(201)
        .expect(conformeA(UN_INGREDIENT));

      expect(reponse.body).toMatchObject({
        name: 'creme fraiche epaisse',
        displayName: 'Crème fraîche épaisse',
        canonicalUnit: 'GRAM',
        gramsPerPiece: null,
        allergens: ['MILK'],
        perishable: true,
      });
    });

    it('garde un poids à la pièce en grammes', async () => {
      const oeuf = await creer(jeu.a, {
        displayName: 'Œuf de poule',
        canonicalUnit: 'PIECE',
        gramsPerPiece: 55.5,
        allergens: ['EGGS'],
      });

      expect(oeuf.gramsPerPiece).toBe(55.5);
      expect(oeuf.perishable).toBe(false);
    });

    it('rend à la relecture le poids à la pièce saisi, au centième près', async () => {
      const figue = await creer(jeu.a, {
        displayName: 'Figue fraîche',
        canonicalUnit: 'PIECE',
        gramsPerPiece: 42.37,
      });

      const relue = await request(app.getHttpServer())
        .get(`/api/ingredients/${figue.id}`)
        .set('Cookie', jeu.a.session)
        .expect(200);

      expect(figue.gramsPerPiece).toBe(42.37);
      expect(relue.body.gramsPerPiece).toBe(42.37);
    });

    it('refuse en 400 un poids à la pièce plus fin que le centième, que la base arrondirait', async () => {
      for (const gramsPerPiece of [0.001, 55.555]) {
        await request(app.getHttpServer())
          .post('/api/ingredients')
          .set('Cookie', jeu.a.session)
          .send({
            displayName: 'Grain de poivre',
            canonicalUnit: 'PIECE',
            gramsPerPiece,
          })
          .expect(400)
          .expect(champsEnErreur(['gramsPerPiece']));
      }
    });

    it('refuse en 400 une saisie sans libellé ni unité, champ par champ', async () => {
      await request(app.getHttpServer())
        .post('/api/ingredients')
        .set('Cookie', jeu.a.session)
        .send({ allergens: ['MILK'] })
        .expect(400)
        .expect(champsEnErreur(['displayName', 'canonicalUnit']));
    });

    it('refuse en 400 un Allergène hors des quatorze familles', async () => {
      await request(app.getHttpServer())
        .post('/api/ingredients')
        .set('Cookie', jeu.a.session)
        .send({
          displayName: 'Beurre doux',
          canonicalUnit: 'GRAM',
          allergens: ['BUTTER'],
        })
        .expect(400)
        .expect(champsEnErreur(['allergens.0']));
    });

    it('refuse en 422 un nom qui ne diffère que par la casse ou les accents', async () => {
      await creer(jeu.a, { displayName: 'Pâte brisée', canonicalUnit: 'GRAM' });

      await request(app.getHttpServer())
        .post('/api/ingredients')
        .set('Cookie', jeu.b.session)
        .send({ displayName: 'PATE  BRISEE.', canonicalUnit: 'GRAM' })
        .expect(422)
        .expect(codeDErreur('food.ingredient_duplicate'));
    });

    it('refuse en 422 un poids à la pièce sur un Ingrédient compté en millilitres', async () => {
      await request(app.getHttpServer())
        .post('/api/ingredients')
        .set('Cookie', jeu.a.session)
        .send({
          displayName: 'Lait demi-écrémé',
          canonicalUnit: 'MILLILITER',
          gramsPerPiece: 1000,
        })
        .expect(422)
        .expect(codeDErreur('food.grams_per_piece_not_applicable'));
    });

    it('refuse en 401 une création sans session', async () => {
      await request(app.getHttpServer())
        .post('/api/ingredients')
        .send({ displayName: 'Anonyme', canonicalUnit: 'GRAM' })
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('GET /ingredients', () => {
    it('rend tout le catalogue, par nom, conforme au contrat', async () => {
      const poivron = await creer(jeu.a, {
        displayName: 'Poivron vert catalogue',
        canonicalUnit: 'PIECE',
      });
      const ail = await creer(jeu.b, {
        displayName: 'Ail catalogue',
        canonicalUnit: 'PIECE',
      });

      const reponse = await request(app.getHttpServer())
        .get('/api/ingredients')
        .set('Cookie', jeu.a.session)
        .expect(200)
        .expect(conformeA(DES_INGREDIENTS));

      const noms = (reponse.body as Ingredient[]).map(({ name }) => name);
      expect(noms).toEqual([...noms].sort());
      // Le catalogue n'a pas d'Espace : ce que B a créé, A le voit.
      expect(noms).toEqual(expect.arrayContaining([poivron.name, ail.name]));
    });

    it('filtre sur chaque mot de `q`, normalisé comme le nom', async () => {
      const rouge = await creer(jeu.a, {
        displayName: 'Oignon rouge recherché',
        canonicalUnit: 'PIECE',
      });
      const jaune = await creer(jeu.a, {
        displayName: 'Oignon jaune recherché',
        canonicalUnit: 'PIECE',
      });

      const reponse = await request(app.getHttpServer())
        .get('/api/ingredients')
        .query({ q: '  RECHERCHE   rouge ' })
        .set('Cookie', jeu.b.session)
        .expect(200)
        .expect(conformeA(DES_INGREDIENTS));

      const ids = (reponse.body as Ingredient[]).map(({ id }) => id);
      expect(ids).toContain(rouge.id);
      expect(ids).not.toContain(jaune.id);
    });

    it('refuse en 400 une recherche démesurée', async () => {
      await request(app.getHttpServer())
        .get('/api/ingredients')
        .query({ q: 'x'.repeat(121) })
        .set('Cookie', jeu.a.session)
        .expect(400)
        .expect(champsEnErreur(['q']));
    });

    it('refuse en 401 une lecture sans session', async () => {
      await request(app.getHttpServer())
        .get('/api/ingredients')
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('GET /ingredients/:id', () => {
    it("rend l'Ingrédient, conforme au contrat, aux deux Comptes", async () => {
      const farine = await creer(jeu.a, {
        displayName: 'Farine de seigle',
        canonicalUnit: 'GRAM',
        allergens: ['GLUTEN'],
      });

      const reponse = await request(app.getHttpServer())
        .get(`/api/ingredients/${farine.id}`)
        .set('Cookie', jeu.b.session)
        .expect(200)
        .expect(conformeA(UN_INGREDIENT));

      expect(reponse.body).toEqual(farine);
    });

    it('répond 404 pour un Ingrédient inconnu', async () => {
      await request(app.getHttpServer())
        .get(`/api/ingredients/${INCONNU}`)
        .set('Cookie', jeu.a.session)
        .expect(404)
        .expect(codeDErreur('food.ingredient_not_found'));
    });

    it('refuse en 401 une lecture sans session', async () => {
      await request(app.getHttpServer())
        .get(`/api/ingredients/${INCONNU}`)
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('PATCH /ingredients/:id', () => {
    it('modifie ce que la saisie porte, et renomme avec le libellé', async () => {
      const tomate = await creer(jeu.a, {
        displayName: 'Tomate cerise',
        canonicalUnit: 'GRAM',
      });

      const reponse = await request(app.getHttpServer())
        .patch(`/api/ingredients/${tomate.id}`)
        .set('Cookie', jeu.b.session)
        .send({ displayName: 'Tomate cerise grappe', perishable: true })
        .expect(200)
        .expect(conformeA(UN_INGREDIENT));

      expect(reponse.body).toEqual({
        ...tomate,
        name: 'tomate cerise grappe',
        displayName: 'Tomate cerise grappe',
        perishable: true,
      });
    });

    it('garde son nom à un Ingrédient dont seule la casse du libellé change', async () => {
      const cumin = await creer(jeu.a, {
        displayName: 'cumin moulu',
        canonicalUnit: 'GRAM',
      });

      await request(app.getHttpServer())
        .patch(`/api/ingredients/${cumin.id}`)
        .set('Cookie', jeu.a.session)
        .send({ displayName: 'Cumin moulu' })
        .expect(200);
    });

    it('refuse en 400 une unité inconnue', async () => {
      const sucre = await creer(jeu.a, {
        displayName: 'Sucre en poudre',
        canonicalUnit: 'GRAM',
      });

      await request(app.getHttpServer())
        .patch(`/api/ingredients/${sucre.id}`)
        .set('Cookie', jeu.a.session)
        .send({ canonicalUnit: 'KILO' })
        .expect(400)
        .expect(champsEnErreur(['canonicalUnit']));
    });

    it("refuse en 422 un libellé qui reprend le nom d'un autre Ingrédient", async () => {
      await creer(jeu.a, { displayName: 'Échalote', canonicalUnit: 'PIECE' });
      const autre = await creer(jeu.a, {
        displayName: 'Échalote grise',
        canonicalUnit: 'PIECE',
      });

      await request(app.getHttpServer())
        .patch(`/api/ingredients/${autre.id}`)
        .set('Cookie', jeu.a.session)
        .send({ displayName: 'echalote' })
        .expect(422)
        .expect(codeDErreur('food.ingredient_duplicate'));
    });

    it('refuse en 422 de passer en millilitres un Ingrédient qui a un poids à la pièce', async () => {
      const citron = await creer(jeu.a, {
        displayName: 'Citron jaune',
        canonicalUnit: 'PIECE',
        gramsPerPiece: 120,
      });

      await request(app.getHttpServer())
        .patch(`/api/ingredients/${citron.id}`)
        .set('Cookie', jeu.a.session)
        .send({ canonicalUnit: 'MILLILITER' })
        .expect(422)
        .expect(codeDErreur('food.grams_per_piece_not_applicable'));

      // Retirer le poids dans la même saisie lève l'objection.
      await request(app.getHttpServer())
        .patch(`/api/ingredients/${citron.id}`)
        .set('Cookie', jeu.a.session)
        .send({ canonicalUnit: 'MILLILITER', gramsPerPiece: null })
        .expect(200);
    });

    it('ne laisse pas deux modifications simultanées poser un poids à la pièce en millilitres', async () => {
      const ingredients = await Promise.all(
        [1, 2, 3, 4, 5].map((n) =>
          creer(jeu.a, {
            displayName: `Sirop concurrent ${n}`,
            canonicalUnit: 'GRAM',
          }),
        ),
      );

      for (const { id } of ingredients) {
        const [enMillilitres, avecUnPoids] = await Promise.all([
          request(app.getHttpServer())
            .patch(`/api/ingredients/${id}`)
            .set('Cookie', jeu.a.session)
            .send({ canonicalUnit: 'MILLILITER' }),
          request(app.getHttpServer())
            .patch(`/api/ingredients/${id}`)
            .set('Cookie', jeu.b.session)
            .send({ gramsPerPiece: 100 }),
        ]);

        // L'une passe, l'autre est refusée par la règle, jamais par une 500.
        expect([enMillilitres.status, avecUnPoids.status].sort()).toEqual([
          200, 422,
        ]);
        const refus =
          enMillilitres.status === 422 ? enMillilitres : avecUnPoids;
        expect(refus.body.code).toBe('food.grams_per_piece_not_applicable');

        const final = await prisma.ingredient.findUniqueOrThrow({
          where: { id },
        });
        expect(
          final.canonicalUnit === 'MILLILITER' && final.gramsPerPiece !== null,
        ).toBe(false);
      }
    });

    it('a sa règle du poids à la pièce gardée par la base elle-même', async () => {
      await expect(
        prisma.ingredient.create({
          data: {
            name: 'creme liquide en direct',
            displayName: 'Crème liquide en direct',
            canonicalUnit: 'MILLILITER',
            gramsPerPiece: 10,
          },
        }),
      ).rejects.toThrow();
    });

    it('refuse en 422 une modification vide', async () => {
      const sel = await creer(jeu.a, {
        displayName: 'Sel fin',
        canonicalUnit: 'GRAM',
      });

      await request(app.getHttpServer())
        .patch(`/api/ingredients/${sel.id}`)
        .set('Cookie', jeu.a.session)
        .send({})
        .expect(422)
        .expect(codeDErreur('food.ingredient_empty_update'));
    });

    it('répond 404 pour un Ingrédient inconnu', async () => {
      await request(app.getHttpServer())
        .patch(`/api/ingredients/${INCONNU}`)
        .set('Cookie', jeu.a.session)
        .send({ perishable: true })
        .expect(404)
        .expect(codeDErreur('food.ingredient_not_found'));
    });

    it('refuse en 401 une modification sans session', async () => {
      await request(app.getHttpServer())
        .patch(`/api/ingredients/${INCONNU}`)
        .send({ perishable: true })
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  async function creer(
    compte: CompteDeTest,
    saisie: Record<string, unknown>,
  ): Promise<Ingredient> {
    const reponse = await request(app.getHttpServer())
      .post('/api/ingredients')
      .set('Cookie', compte.session)
      .send(saisie)
      .expect(201);

    return reponse.body as Ingredient;
  }
});
