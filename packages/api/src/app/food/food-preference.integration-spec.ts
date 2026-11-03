import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  zFoodPreference,
  zHousehold,
  type FoodPreference,
  type Ingredient,
} from '@personal-os/contracts';
import {
  ID_ESPACE_FOYER,
  PrismaService,
  sousPortee,
} from '@personal-os/database';
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

/** Une Préférence exactement conforme au contrat, sans un champ de plus. */
const UNE_PREFERENCE = z.discriminatedUnion('target', [
  zFoodPreference.options[0].strict(),
  zFoodPreference.options[1].strict(),
]);
const DES_PREFERENCES = z.array(UNE_PREFERENCE);

const INCONNU = '00000000-0000-4000-8000-000000000000';

const SOUS_L_ESPACE_FOYER = {
  espaces: [{ id: ID_ESPACE_FOYER, kind: 'HOUSEHOLD' as const }],
  typesAcceptes: ['HOUSEHOLD' as const],
};

/**
 * La Cuisine est à Espace unique, l'Espace foyer : il n'y a pas de 404 croisé
 * entre Espaces personnels à prouver (ADR 0030). On prouve au contraire que
 * les deux Comptes voient et modifient les Préférences des deux.
 *
 * La campagne partage sa base entre les fichiers, et l'unicité interdit de
 * poser deux fois la même Préférence : chaque test vise ses propres cibles.
 */
describe('Préférences alimentaires', () => {
  let authentik: FauxAuthentik;
  let app: INestApplication;
  let jeu: JeuDEspaces;
  let prisma: PrismaService;
  let compteA: string;
  let compteB: string;

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

  describe('POST /food-preferences', () => {
    it('enregistre une allergie à un Allergène, conforme au contrat', async () => {
      const reponse = await request(app.getHttpServer())
        .post('/api/food-preferences')
        .set('Cookie', jeu.a.session)
        .send({
          userId: compteA,
          kind: 'ALLERGY',
          target: 'ALLERGEN',
          allergen: 'TREE_NUTS',
        })
        .expect(201)
        .expect(conformeA(UNE_PREFERENCE));

      expect(reponse.body).toMatchObject({
        userId: compteA,
        kind: 'ALLERGY',
        target: 'ALLERGEN',
        allergen: 'TREE_NUTS',
      });
    });

    it("enregistre un aliment peu apprécié, avec le libellé de l'Ingrédient", async () => {
      const coriandre = await ingredient('Coriandre des préférences');

      const reponse = await request(app.getHttpServer())
        .post('/api/food-preferences')
        .set('Cookie', jeu.a.session)
        .send({
          userId: compteA,
          kind: 'DISLIKED',
          target: 'INGREDIENT',
          ingredientId: coriandre.id,
        })
        .expect(201)
        .expect(conformeA(UNE_PREFERENCE));

      expect(reponse.body).toMatchObject({
        target: 'INGREDIENT',
        ingredientId: coriandre.id,
        ingredientDisplayName: 'Coriandre des préférences',
      });
    });

    it("pose la Préférence d'un Compte dans l'Espace foyer, quel que soit l'auteur", async () => {
      const preference = await creer(jeu.b, {
        userId: compteA,
        kind: 'EXCLUDED',
        target: 'ALLERGEN',
        allergen: 'MOLLUSCS',
      });

      // Une requête Prisma ne part qu'à l'`await` : il se fait sous la portée.
      const enBase = await sousPortee(SOUS_L_ESPACE_FOYER, async () =>
        prisma.foodPreference.findUniqueOrThrow({
          where: { id: preference.id },
        }),
      );
      expect(enBase.scopeId).toBe(jeu.espaceFoyer);
    });

    it.each([
      [
        'les deux cibles',
        { target: 'ALLERGEN', allergen: 'MILK', ingredientId: INCONNU },
        'ingredientId',
      ],
      ['aucune cible', {}, 'target'],
    ])(
      'refuse en 400 une saisie qui nomme %s, et dit la règle',
      async (_cas, cible, champ) => {
        const reponse = await request(app.getHttpServer())
          .post('/api/food-preferences')
          .set('Cookie', jeu.a.session)
          .send({ userId: compteA, kind: 'ALLERGY', ...cible })
          .expect(400)
          .expect(champsEnErreur([champ]));

        expect(reponse.body.fields[0].message).toBe(
          'Une Préférence alimentaire vise soit un Allergène, soit un Ingrédient : jamais les deux, ni aucun.',
        );
      },
    );

    it.each([
      ['un Allergène absent', { target: 'ALLERGEN' }, 'allergen'],
      ['un Ingrédient absent', { target: 'INGREDIENT' }, 'ingredientId'],
      [
        'un Allergène hors liste',
        { target: 'ALLERGEN', allergen: 'NUTS' },
        'allergen',
      ],
    ])('refuse en 400 une saisie qui nomme %s', async (_cas, cible, champ) => {
      await request(app.getHttpServer())
        .post('/api/food-preferences')
        .set('Cookie', jeu.a.session)
        .send({ userId: compteA, kind: 'ALLERGY', ...cible })
        .expect(400)
        .expect(champsEnErreur([champ]));
    });

    it('refuse en 400 un type de Préférence inconnu', async () => {
      await request(app.getHttpServer())
        .post('/api/food-preferences')
        .set('Cookie', jeu.a.session)
        .send({
          userId: compteA,
          kind: 'VEGETARIAN',
          target: 'ALLERGEN',
          allergen: 'MILK',
        })
        .expect(400)
        .expect(champsEnErreur(['kind']));
    });

    it('refuse en 422 une Préférence déjà enregistrée', async () => {
      const saisie = {
        userId: compteB,
        kind: 'ALLERGY',
        target: 'ALLERGEN',
        allergen: 'SESAME',
      };
      await creer(jeu.a, saisie);

      await request(app.getHttpServer())
        .post('/api/food-preferences')
        .set('Cookie', jeu.b.session)
        .send(saisie)
        .expect(422)
        .expect(codeDErreur('food.preference_duplicate'));
    });

    it('refuse en 422 un doublon sur un Ingrédient', async () => {
      const ail = await ingredient('Ail des préférences');
      const saisie = {
        userId: compteB,
        kind: 'EXCLUDED',
        target: 'INGREDIENT',
        ingredientId: ail.id,
      };
      await creer(jeu.b, saisie);

      await request(app.getHttpServer())
        .post('/api/food-preferences')
        .set('Cookie', jeu.b.session)
        .send(saisie)
        .expect(422)
        .expect(codeDErreur('food.preference_duplicate'));
    });

    it("accepte la même cible sous un autre type, ou pour l'autre Compte", async () => {
      await creer(jeu.a, {
        userId: compteA,
        kind: 'ALLERGY',
        target: 'ALLERGEN',
        allergen: 'LUPIN',
      });

      await creer(jeu.a, {
        userId: compteA,
        kind: 'EXCLUDED',
        target: 'ALLERGEN',
        allergen: 'LUPIN',
      });
      await creer(jeu.a, {
        userId: compteB,
        kind: 'ALLERGY',
        target: 'ALLERGEN',
        allergen: 'LUPIN',
      });
    });

    it('refuse en 422 un Compte hors du Foyer', async () => {
      await request(app.getHttpServer())
        .post('/api/food-preferences')
        .set('Cookie', jeu.a.session)
        .send({
          userId: INCONNU,
          kind: 'ALLERGY',
          target: 'ALLERGEN',
          allergen: 'MILK',
        })
        .expect(422)
        .expect(codeDErreur('food.unknown_member'));
    });

    it('refuse en 422 un Ingrédient absent du catalogue', async () => {
      await request(app.getHttpServer())
        .post('/api/food-preferences')
        .set('Cookie', jeu.a.session)
        .send({
          userId: compteA,
          kind: 'DISLIKED',
          target: 'INGREDIENT',
          ingredientId: INCONNU,
        })
        .expect(422)
        .expect(codeDErreur('food.unknown_ingredient'));
    });

    it('refuse en 401 une création sans session', async () => {
      await request(app.getHttpServer())
        .post('/api/food-preferences')
        .send({
          userId: compteA,
          kind: 'ALLERGY',
          target: 'ALLERGEN',
          allergen: 'MILK',
        })
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });

    it('laisse la base refuser une Préférence qui viserait les deux, ou aucune', async () => {
      const beurre = await ingredient('Beurre des préférences');

      for (const cible of [
        { allergen: 'MILK' as const, ingredientId: beurre.id },
        { allergen: null, ingredientId: null },
      ]) {
        await expect(
          sousPortee(SOUS_L_ESPACE_FOYER, async () =>
            prisma.foodPreference.create({
              data: {
                scopeId: ID_ESPACE_FOYER,
                userId: compteA,
                kind: 'EXCLUDED',
                ...cible,
              },
            }),
          ),
        ).rejects.toThrow(/FoodPreference_target_check/);
      }
    });
  });

  describe('GET /food-preferences', () => {
    it('rend les Préférences des deux Comptes, à chacun des deux', async () => {
      const deA = await creer(jeu.a, {
        userId: compteA,
        kind: 'DISLIKED',
        target: 'ALLERGEN',
        allergen: 'CELERY',
      });
      const deB = await creer(jeu.b, {
        userId: compteB,
        kind: 'DISLIKED',
        target: 'ALLERGEN',
        allergen: 'CELERY',
      });

      for (const compte of [jeu.a, jeu.b]) {
        const reponse = await request(app.getHttpServer())
          .get('/api/food-preferences')
          .set('Cookie', compte.session)
          .expect(200)
          .expect(conformeA(DES_PREFERENCES));

        const ids = (reponse.body as FoodPreference[]).map(({ id }) => id);
        expect(ids).toEqual(expect.arrayContaining([deA.id, deB.id]));
        expect(ids.indexOf(deA.id)).toBeLessThan(ids.indexOf(deB.id));
      }
    });

    it("ne rend que celles d'un Compte quand on le nomme", async () => {
      const deB = await creer(jeu.a, {
        userId: compteB,
        kind: 'EXCLUDED',
        target: 'ALLERGEN',
        allergen: 'MUSTARD',
      });

      const reponse = await request(app.getHttpServer())
        .get('/api/food-preferences')
        .query({ userId: compteB })
        .set('Cookie', jeu.a.session)
        .expect(200)
        .expect(conformeA(DES_PREFERENCES));

      const preferences = reponse.body as FoodPreference[];
      expect(preferences.map(({ id }) => id)).toContain(deB.id);
      expect(preferences.every(({ userId }) => userId === compteB)).toBe(true);
    });

    it('refuse en 400 un Compte vide', async () => {
      await request(app.getHttpServer())
        .get('/api/food-preferences')
        .query({ userId: ' ' })
        .set('Cookie', jeu.a.session)
        .expect(400)
        .expect(champsEnErreur(['userId']));
    });

    it('refuse en 422 un Compte hors du Foyer', async () => {
      await request(app.getHttpServer())
        .get('/api/food-preferences')
        .query({ userId: INCONNU })
        .set('Cookie', jeu.a.session)
        .expect(422)
        .expect(codeDErreur('food.unknown_member'));
    });

    it('refuse en 401 une lecture sans session', async () => {
      await request(app.getHttpServer())
        .get('/api/food-preferences')
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('DELETE /food-preferences/:id', () => {
    it("supprime la Préférence de l'autre Compte", async () => {
      const deA = await creer(jeu.a, {
        userId: compteA,
        kind: 'ALLERGY',
        target: 'ALLERGEN',
        allergen: 'SOY',
      });

      await request(app.getHttpServer())
        .delete(`/api/food-preferences/${deA.id}`)
        .set('Cookie', jeu.b.session)
        .expect(204);

      const reponse = await request(app.getHttpServer())
        .get('/api/food-preferences')
        .query({ userId: compteA })
        .set('Cookie', jeu.a.session)
        .expect(200);
      expect(
        (reponse.body as FoodPreference[]).map(({ id }) => id),
      ).not.toContain(deA.id);

      // Supprimée, la même Préférence se pose de nouveau.
      await creer(jeu.a, {
        userId: compteA,
        kind: 'ALLERGY',
        target: 'ALLERGEN',
        allergen: 'SOY',
      });
    });

    it('refuse en 404 une Préférence inconnue', async () => {
      await request(app.getHttpServer())
        .delete(`/api/food-preferences/${INCONNU}`)
        .set('Cookie', jeu.a.session)
        .expect(404)
        .expect(codeDErreur('food.preference_not_found'));
    });

    it('refuse en 401 une suppression sans session', async () => {
      await request(app.getHttpServer())
        .delete(`/api/food-preferences/${INCONNU}`)
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  async function creer(
    compte: CompteDeTest,
    saisie: Record<string, unknown>,
  ): Promise<FoodPreference> {
    const reponse = await request(app.getHttpServer())
      .post('/api/food-preferences')
      .set('Cookie', compte.session)
      .send(saisie)
      .expect(201);
    return reponse.body as FoodPreference;
  }

  async function ingredient(displayName: string): Promise<Ingredient> {
    const reponse = await request(app.getHttpServer())
      .post('/api/ingredients')
      .set('Cookie', jeu.a.session)
      .send({ displayName, canonicalUnit: 'GRAM' })
      .expect(201);
    return reponse.body as Ingredient;
  }
});
