import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  zRecipe,
  zRecipeLine,
  type Ingredient,
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

/** Une Recette exactement conforme au contrat, jusque dans ses lignes. */
const UNE_LIGNE = zRecipeLine
  .extend({ ingredient: zRecipeLine.shape.ingredient.strict() })
  .strict();
const UNE_RECETTE = zRecipe.extend({ lines: z.array(UNE_LIGNE) }).strict();
const DES_RECETTES = z.array(UNE_RECETTE);

const INCONNU = '00000000-0000-4000-8000-000000000000';

/**
 * La Cuisine vit dans l'Espace foyer : une Recette est aux deux Comptes. Il
 * n'y a donc pas de 404 croisé à prouver (ADR 0030) ; on prouve que chacun
 * lit et modifie les recettes de l'autre, et que les lignes portent l'Espace
 * de leur recette (SOCLE-6).
 *
 * La campagne partage sa base entre les fichiers : chaque test nomme ses
 * recettes et ses Ingrédients d'un libellé qui lui est propre.
 */
describe('Recettes', () => {
  let authentik: FauxAuthentik;
  let app: INestApplication;
  let jeu: JeuDEspaces;
  let prisma: PrismaService;
  let lentilles: Ingredient;
  let oignon: Ingredient;
  let cumin: Ingredient;

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

    lentilles = await ingredient('Lentilles corail (recettes)', 'GRAM');
    oignon = await ingredient('Oignon jaune (recettes)', 'PIECE');
    cumin = await ingredient('Cumin moulu (recettes)', 'GRAM');
  });

  afterAll(async () => {
    await app?.close();
    await authentik?.close();
  });

  describe('POST /recipes', () => {
    it('crée une Recette manuelle avec ses lignes, dans leur ordre et leur unité saisie', async () => {
      const reponse = await request(app.getHttpServer())
        .post('/api/recipes')
        .set('Cookie', jeu.a.session)
        .send({
          title: '  Dahl du lundi ',
          servings: 4,
          steps: ['Rincer les lentilles.', 'Mijoter 20 minutes.'],
          lines: [
            { ingredientId: lentilles.id, quantity: 250, unit: 'G' },
            { ingredientId: oignon.id, quantity: 1, unit: 'PIECE' },
            { ingredientId: cumin.id, quantity: 1.5, unit: 'TSP' },
          ],
        })
        .expect(201)
        .expect(conformeA(UNE_RECETTE));

      expect(reponse.body).toMatchObject({
        title: 'Dahl du lundi',
        servings: 4,
        steps: ['Rincer les lentilles.', 'Mijoter 20 minutes.'],
        source: 'MANUAL',
        lines: [
          {
            ingredient: {
              id: lentilles.id,
              displayName: lentilles.displayName,
            },
            quantity: 250,
            unit: 'G',
          },
          {
            ingredient: { id: oignon.id, displayName: oignon.displayName },
            quantity: 1,
            unit: 'PIECE',
          },
          {
            ingredient: { id: cumin.id, displayName: cumin.displayName },
            quantity: 1.5,
            unit: 'TSP',
          },
        ],
      });
    });

    it("range la recette et chacune de ses lignes dans l'Espace foyer", async () => {
      const recette = await creer(jeu.a, { title: 'Dahl rangé' });

      const espaces = await sousPortee(
        {
          espaces: [{ id: jeu.espaceFoyer, kind: 'HOUSEHOLD' }],
          typesAcceptes: ['HOUSEHOLD'],
        },
        async () => ({
          recette: await prisma.recipe.findUniqueOrThrow({
            where: { id: recette.id },
            select: { scopeId: true },
          }),
          lignes: await prisma.recipeLine.findMany({
            where: { recipeId: recette.id },
            select: { scopeId: true },
          }),
        }),
      );

      expect(espaces.recette.scopeId).toBe(jeu.espaceFoyer);
      expect(espaces.lignes).toEqual([
        { scopeId: jeu.espaceFoyer },
        { scopeId: jeu.espaceFoyer },
      ]);
    });

    it("ne laisse pas choisir l'origine : une recette saisie est manuelle", async () => {
      const recette = await creer(jeu.a, {
        title: 'Dahl prétendu généré',
        source: 'GENERATED',
      });

      expect(recette.source).toBe('MANUAL');
    });

    it('refuse une saisie hors contrat, champ par champ', async () => {
      await request(app.getHttpServer())
        .post('/api/recipes')
        .set('Cookie', jeu.a.session)
        .send({
          title: 'Dahl mal saisi',
          servings: 0,
          lines: [{ ingredientId: lentilles.id, quantity: -1, unit: 'CUP' }],
        })
        .expect(400)
        .expect(
          champsEnErreur(['servings', 'lines.0.quantity', 'lines.0.unit']),
        );
    });

    it("refuse une ligne dont l'Ingrédient n'est pas au catalogue", async () => {
      await request(app.getHttpServer())
        .post('/api/recipes')
        .set('Cookie', jeu.a.session)
        .send({
          title: 'Dahl fantôme',
          servings: 2,
          lines: [
            { ingredientId: lentilles.id, quantity: 200, unit: 'G' },
            { ingredientId: INCONNU, quantity: 1, unit: 'PIECE' },
          ],
        })
        .expect(422)
        .expect(codeDErreur('food.recipe_unknown_ingredient'));
    });

    it('refuse une requête sans session', async () => {
      await request(app.getHttpServer())
        .post('/api/recipes')
        .send(saisie({ title: 'Dahl anonyme' }))
        .expect(401);
    });
  });

  describe('GET /recipes', () => {
    it('rend les recettes du Foyer, par titre, à chacun des deux Comptes', async () => {
      const b = await creer(jeu.a, { title: 'Bortsch du Foyer' });
      const a = await creer(jeu.b, { title: 'Aligot du Foyer' });

      for (const compte of [jeu.a, jeu.b]) {
        const reponse = await request(app.getHttpServer())
          .get('/api/recipes')
          .query({ q: 'du foyer' })
          .set('Cookie', compte.session)
          .expect(200)
          .expect(conformeA(DES_RECETTES));

        expect((reponse.body as Recipe[]).map(({ id }) => id)).toEqual([
          a.id,
          b.id,
        ]);
      }
    });

    it('cherche chaque mot de `q` dans le titre, sans égard à la casse', async () => {
      const gratin = await creer(jeu.a, { title: 'Gratin de courge rôtie' });
      await creer(jeu.a, { title: 'Velouté de courge' });

      const reponse = await request(app.getHttpServer())
        .get('/api/recipes')
        .query({ q: '  COURGE   gratin ' })
        .set('Cookie', jeu.a.session)
        .expect(200);

      expect((reponse.body as Recipe[]).map(({ id }) => id)).toEqual([
        gratin.id,
      ]);
    });

    it('refuse une recherche hors borne', async () => {
      await request(app.getHttpServer())
        .get('/api/recipes')
        .query({ q: 'x'.repeat(121) })
        .set('Cookie', jeu.a.session)
        .expect(400)
        .expect(champsEnErreur(['q']));
    });

    it('refuse une requête sans session', async () => {
      await request(app.getHttpServer()).get('/api/recipes').expect(401);
    });
  });

  describe('GET /recipes/:id', () => {
    it("rend la recette de l'autre Compte, conforme au contrat", async () => {
      const recette = await creer(jeu.a, { title: 'Dahl partagé' });

      const reponse = await request(app.getHttpServer())
        .get(`/api/recipes/${recette.id}`)
        .set('Cookie', jeu.b.session)
        .expect(200)
        .expect(conformeA(UNE_RECETTE));

      expect(reponse.body).toEqual(recette);
    });

    it('répond 404 pour une recette inconnue', async () => {
      await request(app.getHttpServer())
        .get(`/api/recipes/${INCONNU}`)
        .set('Cookie', jeu.a.session)
        .expect(404)
        .expect(codeDErreur('food.recipe_not_found'));
    });

    it('refuse une requête sans session', async () => {
      await request(app.getHttpServer())
        .get(`/api/recipes/${INCONNU}`)
        .expect(401);
    });
  });

  describe('PATCH /recipes/:id', () => {
    it('ne change que ce que la modification porte, et garde les lignes', async () => {
      const recette = await creer(jeu.a, { title: 'Dahl à agrandir' });

      const reponse = await request(app.getHttpServer())
        .patch(`/api/recipes/${recette.id}`)
        .set('Cookie', jeu.b.session)
        .send({ servings: 6, steps: ['Tout mettre à cuire.'] })
        .expect(200)
        .expect(conformeA(UNE_RECETTE));

      expect(reponse.body).toMatchObject({
        title: 'Dahl à agrandir',
        servings: 6,
        steps: ['Tout mettre à cuire.'],
        lines: recette.lines,
      });
    });

    it('remplace toutes les lignes quand elles sont fournies, sans en garder une', async () => {
      const recette = await creer(jeu.a, { title: 'Dahl à refaire' });

      const reponse = await request(app.getHttpServer())
        .patch(`/api/recipes/${recette.id}`)
        .set('Cookie', jeu.a.session)
        .send({
          lines: [
            { ingredientId: cumin.id, quantity: 2, unit: 'TBSP' },
            { ingredientId: lentilles.id, quantity: 0.3, unit: 'KG' },
          ],
        })
        .expect(200)
        .expect(conformeA(UNE_RECETTE));

      const lignes = (reponse.body as Recipe).lines;
      expect(lignes).toMatchObject([
        { ingredient: { id: cumin.id }, quantity: 2, unit: 'TBSP' },
        { ingredient: { id: lentilles.id }, quantity: 0.3, unit: 'KG' },
      ]);
      const anciennes = new Set(recette.lines.map(({ id }) => id));
      expect(lignes.some(({ id }) => anciennes.has(id))).toBe(false);

      const enBase = await sousPortee(
        {
          espaces: [{ id: jeu.espaceFoyer, kind: 'HOUSEHOLD' }],
          typesAcceptes: ['HOUSEHOLD'],
        },
        async () =>
          await prisma.recipeLine.findMany({
            where: { recipeId: recette.id },
            select: { scopeId: true },
          }),
      );
      expect(enBase).toEqual([
        { scopeId: jeu.espaceFoyer },
        { scopeId: jeu.espaceFoyer },
      ]);
    });

    it("garde les anciennes lignes si l'une des nouvelles cite un Ingrédient inconnu", async () => {
      const recette = await creer(jeu.a, { title: 'Dahl à préserver' });

      await request(app.getHttpServer())
        .patch(`/api/recipes/${recette.id}`)
        .set('Cookie', jeu.a.session)
        .send({ lines: [{ ingredientId: INCONNU, quantity: 1, unit: 'G' }] })
        .expect(422)
        .expect(codeDErreur('food.recipe_unknown_ingredient'));

      const relue = await request(app.getHttpServer())
        .get(`/api/recipes/${recette.id}`)
        .set('Cookie', jeu.a.session)
        .expect(200);
      expect(relue.body).toEqual(recette);
    });

    it('refuse une modification vide', async () => {
      const recette = await creer(jeu.a, { title: 'Dahl immuable' });

      await request(app.getHttpServer())
        .patch(`/api/recipes/${recette.id}`)
        .set('Cookie', jeu.a.session)
        .send({})
        .expect(422)
        .expect(codeDErreur('food.recipe_empty_update'));
    });

    it('refuse des lignes vides, champ par champ', async () => {
      const recette = await creer(jeu.a, { title: 'Dahl sans lignes' });

      await request(app.getHttpServer())
        .patch(`/api/recipes/${recette.id}`)
        .set('Cookie', jeu.a.session)
        .send({ title: ' ', lines: [] })
        .expect(400)
        .expect(champsEnErreur(['title', 'lines']));
    });

    it('répond 404 pour une recette inconnue', async () => {
      await request(app.getHttpServer())
        .patch(`/api/recipes/${INCONNU}`)
        .set('Cookie', jeu.a.session)
        .send({
          servings: 2,
          lines: [{ ingredientId: cumin.id, quantity: 1, unit: 'G' }],
        })
        .expect(404)
        .expect(codeDErreur('food.recipe_not_found'));
    });

    it('refuse une requête sans session', async () => {
      await request(app.getHttpServer())
        .patch(`/api/recipes/${INCONNU}`)
        .send({ servings: 2 })
        .expect(401);
    });
  });

  describe('DELETE /recipes/:id', () => {
    it('supprime la recette et ses lignes', async () => {
      const recette = await creer(jeu.a, { title: 'Dahl à jeter' });

      await request(app.getHttpServer())
        .delete(`/api/recipes/${recette.id}`)
        .set('Cookie', jeu.b.session)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/api/recipes/${recette.id}`)
        .set('Cookie', jeu.a.session)
        .expect(404);
      const lignes = await sousPortee(
        {
          espaces: [{ id: jeu.espaceFoyer, kind: 'HOUSEHOLD' }],
          typesAcceptes: ['HOUSEHOLD'],
        },
        async () =>
          await prisma.recipeLine.count({ where: { recipeId: recette.id } }),
      );
      expect(lignes).toBe(0);
    });

    it('répond 404 pour une recette inconnue', async () => {
      await request(app.getHttpServer())
        .delete(`/api/recipes/${INCONNU}`)
        .set('Cookie', jeu.a.session)
        .expect(404)
        .expect(codeDErreur('food.recipe_not_found'));
    });

    it('refuse une requête sans session', async () => {
      await request(app.getHttpServer())
        .delete(`/api/recipes/${INCONNU}`)
        .expect(401);
    });
  });

  function saisie(changement: Record<string, unknown>) {
    return {
      title: 'Dahl',
      servings: 4,
      steps: ['Mijoter.'],
      lines: [
        { ingredientId: lentilles.id, quantity: 250, unit: 'G' },
        { ingredientId: oignon.id, quantity: 1, unit: 'PIECE' },
      ],
      ...changement,
    };
  }

  async function creer(
    compte: CompteDeTest,
    changement: Record<string, unknown>,
  ): Promise<Recipe> {
    const reponse = await request(app.getHttpServer())
      .post('/api/recipes')
      .set('Cookie', compte.session)
      .send(saisie(changement))
      .expect(201);

    return reponse.body as Recipe;
  }

  async function ingredient(
    displayName: string,
    canonicalUnit: Ingredient['canonicalUnit'],
  ): Promise<Ingredient> {
    const reponse = await request(app.getHttpServer())
      .post('/api/ingredients')
      .set('Cookie', jeu.a.session)
      .send({ displayName, canonicalUnit })
      .expect(201);

    return reponse.body as Ingredient;
  }
});
