import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  zMealWish,
  type Ingredient,
  type MealWish,
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

const REDIRECT_URI = 'http://app.exemple.test/api/auth/callback';
const DASHBOARD_URL = 'http://app.exemple.test/';
const ADRESSE_A = 'a@exemple.test';
const ADRESSE_B = 'b@exemple.test';

/** Un Souhait exactement conforme au contrat. */
const UN_SOUHAIT = zMealWish
  .extend({ recipe: zMealWish.shape.recipe.unwrap().strict().nullable() })
  .strict();

const INCONNU = '00000000-0000-4000-8000-000000000000';

/**
 * La Cuisine vit dans l'Espace foyer : un Souhait est aux deux Comptes. Il n'y
 * a donc pas de 404 croisé à prouver (ADR 0030) ; on prouve que chacun lit et
 * retire les Souhaits de l'autre.
 *
 * La campagne partage sa base entre les fichiers : chaque test prend une
 * semaine de 2029 qui n'appartient qu'à lui.
 */
describe('Souhaits', () => {
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

    [compteA, compteB] = await Promise.all(
      [ADRESSE_A, ADRESSE_B].map(
        async (email) =>
          (await prisma.user.findUniqueOrThrow({ where: { email } })).id,
      ),
    );

    const reponse = await request(app.getHttpServer())
      .post('/api/ingredients')
      .set('Cookie', jeu.a.session)
      .send({
        displayName: 'Lentilles vertes (souhaits)',
        canonicalUnit: 'GRAM',
      })
      .expect(201);
    lentilles = reponse.body as Ingredient;
  });

  afterAll(async () => {
    await app?.close();
    await authentik?.close();
  });

  describe('POST /meal-wishes', () => {
    it("dépose une envie en texte libre, au nom de son auteur, dans l'Espace foyer", async () => {
      const reponse = await request(app.getHttpServer())
        .post('/api/meal-wishes')
        .set('Cookie', jeu.b.session)
        .send({ week: '2029-01-01', text: '  Un plat de poisson ' })
        .expect(201)
        .expect(conformeA(UN_SOUHAIT));

      expect(reponse.body).toMatchObject({
        week: '2029-01-01',
        recipe: null,
        text: 'Un plat de poisson',
        authorId: compteB,
      });

      const enBase = await dansLeFoyer(
        async () =>
          await prisma.mealWish.findUniqueOrThrow({
            where: { id: reponse.body.id },
          }),
      );
      expect(enBase.scopeId).toBe(jeu.espaceFoyer);
    });

    it('dépose une Recette, nommée par son titre', async () => {
      const recette = await creerUneRecette('Dahl des souhaits');

      const reponse = await request(app.getHttpServer())
        .post('/api/meal-wishes')
        .set('Cookie', jeu.a.session)
        .send({ week: '2029-01-08', recipeId: recette.id })
        .expect(201)
        .expect(conformeA(UN_SOUHAIT));

      expect(reponse.body).toMatchObject({
        week: '2029-01-08',
        recipe: { id: recette.id, title: 'Dahl des souhaits' },
        text: null,
        authorId: compteA,
      });
    });

    it('refuse un Souhait sans recette ni texte, sur `text`', async () => {
      await request(app.getHttpServer())
        .post('/api/meal-wishes')
        .set('Cookie', jeu.a.session)
        .send({ week: '2029-01-15' })
        .expect(400)
        .expect(champsEnErreur(['text']));
    });

    it("refuse une semaine qui n'est pas un lundi, sur `week`", async () => {
      await request(app.getHttpServer())
        .post('/api/meal-wishes')
        .set('Cookie', jeu.a.session)
        .send({ week: '2029-01-17', text: 'Des crêpes' })
        .expect(400)
        .expect(champsEnErreur(['week']));
    });

    it("refuse une Recette qui n'existe pas", async () => {
      await request(app.getHttpServer())
        .post('/api/meal-wishes')
        .set('Cookie', jeu.a.session)
        .send({ week: '2029-01-15', recipeId: INCONNU })
        .expect(422)
        .expect(codeDErreur('food.wish_unknown_recipe'));
    });

    it('refuse une requête sans session', async () => {
      await request(app.getHttpServer())
        .post('/api/meal-wishes')
        .send({ week: '2029-01-15', text: 'Des crêpes' })
        .expect(401);
    });
  });

  describe('GET /meal-wishes', () => {
    it("lit les Souhaits d'une semaine, des deux Comptes, dans l'ordre du dépôt", async () => {
      const premier = await deposer(jeu.a, {
        week: '2029-02-05',
        text: 'Des pâtes fraîches',
      });
      const second = await deposer(jeu.b, {
        week: '2029-02-05',
        text: 'Une soupe',
      });
      await deposer(jeu.a, { week: '2029-02-12', text: 'Pas cette semaine' });

      const reponse = await request(app.getHttpServer())
        .get('/api/meal-wishes?week=2029-02-05')
        .set('Cookie', jeu.b.session)
        .expect(200)
        .expect(conformeA(z.array(UN_SOUHAIT)));

      expect((reponse.body as MealWish[]).map(({ id }) => id)).toEqual([
        premier.id,
        second.id,
      ]);
    });

    it('lit une semaine sans Souhait', async () => {
      await request(app.getHttpServer())
        .get('/api/meal-wishes?week=2029-02-19')
        .set('Cookie', jeu.a.session)
        .expect(200)
        .expect([]);
    });

    it('exige la semaine, par son lundi', async () => {
      await request(app.getHttpServer())
        .get('/api/meal-wishes')
        .set('Cookie', jeu.a.session)
        .expect(400)
        .expect(champsEnErreur(['week']));

      await request(app.getHttpServer())
        .get('/api/meal-wishes?week=2029-02-20')
        .set('Cookie', jeu.a.session)
        .expect(400)
        .expect(champsEnErreur(['week']));
    });

    it('refuse une requête sans session', async () => {
      await request(app.getHttpServer())
        .get('/api/meal-wishes?week=2029-02-19')
        .expect(401);
    });
  });

  describe('DELETE /meal-wishes/:id', () => {
    it("retire un Souhait, même déposé par l'autre Compte", async () => {
      const souhait = await deposer(jeu.a, {
        week: '2029-03-05',
        text: 'Un gratin',
      });

      await request(app.getHttpServer())
        .delete(`/api/meal-wishes/${souhait.id}`)
        .set('Cookie', jeu.b.session)
        .expect(204);

      await request(app.getHttpServer())
        .get('/api/meal-wishes?week=2029-03-05')
        .set('Cookie', jeu.a.session)
        .expect(200)
        .expect([]);
    });

    it('répond 404 pour un Souhait inconnu, ou déjà retiré', async () => {
      await request(app.getHttpServer())
        .delete(`/api/meal-wishes/${INCONNU}`)
        .set('Cookie', jeu.a.session)
        .expect(404)
        .expect(codeDErreur('food.wish_not_found'));
    });

    it('refuse une requête sans session', async () => {
      await request(app.getHttpServer())
        .delete(`/api/meal-wishes/${INCONNU}`)
        .expect(401);
    });
  });

  describe('DELETE /recipes/:id', () => {
    it('laisse son titre au Souhait qui demandait la recette supprimée', async () => {
      const recette = await creerUneRecette('Tajine des souhaits');
      const souhait = await deposer(jeu.a, {
        week: '2029-04-02',
        recipeId: recette.id,
      });

      await request(app.getHttpServer())
        .delete(`/api/recipes/${recette.id}`)
        .set('Cookie', jeu.a.session)
        .expect(204);

      const reponse = await request(app.getHttpServer())
        .get('/api/meal-wishes?week=2029-04-02')
        .set('Cookie', jeu.a.session)
        .expect(200);
      expect(reponse.body).toEqual([
        {
          ...souhait,
          recipe: null,
          text: 'Tajine des souhaits',
        },
      ]);
    });
  });

  describe('la base, seule', () => {
    // La version précédente de l'API supprime une recette sans connaître les
    // Souhaits (ADR 0024) : c'est la base qui leur laisse son titre.
    it('laisse son titre au Souhait quand la recette part sans le détacher', async () => {
      const recette = await creerUneRecette('Couscous des souhaits');
      const souhait = await deposer(jeu.b, {
        week: '2029-04-09',
        recipeId: recette.id,
      });

      await dansLeFoyer(
        async () => await prisma.recipe.delete({ where: { id: recette.id } }),
      );

      const lu = await dansLeFoyer(
        async () =>
          await prisma.mealWish.findUniqueOrThrow({
            where: { id: souhait.id },
          }),
      );
      expect(lu).toMatchObject({
        recipeId: null,
        text: 'Couscous des souhaits',
      });
    });
  });

  async function deposer(
    compte: CompteDeTest,
    saisie: Record<string, unknown>,
  ): Promise<MealWish> {
    const reponse = await request(app.getHttpServer())
      .post('/api/meal-wishes')
      .set('Cookie', compte.session)
      .send(saisie)
      .expect(201);

    return reponse.body as MealWish;
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

  function dansLeFoyer<T>(lecture: () => Promise<T>): Promise<T> {
    return sousPortee(
      {
        espaces: [{ id: jeu.espaceFoyer, kind: 'HOUSEHOLD' }],
        typesAcceptes: ['HOUSEHOLD'],
      },
      lecture,
    );
  }
});
