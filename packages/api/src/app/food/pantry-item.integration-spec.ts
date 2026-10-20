import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  zPantryItem,
  type Ingredient,
  type PantryItem,
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
  type JeuDEspaces,
} from '../../../test/jeu-d-espaces';
import { champsEnErreur, codeDErreur } from '../../../test/code-d-erreur';
import { conformeA } from '../../../test/conforme';
import { AppModule } from '../app.module';

const REDIRECT_URI = 'http://app.exemple.test/api/auth/callback';
const DASHBOARD_URL = 'http://app.exemple.test/';
const ADRESSE_A = 'a@exemple.test';
const ADRESSE_B = 'b@exemple.test';

/** Une ligne exactement conforme au contrat, sans un champ de plus. */
const UNE_LIGNE = zPantryItem
  .extend({ ingredient: zPantryItem.shape.ingredient.strict() })
  .strict();
const DES_LIGNES = z.array(UNE_LIGNE);

const INCONNU = '00000000-0000-4000-8000-000000000000';

const SOUS_L_ESPACE_FOYER = {
  espaces: [{ id: ID_ESPACE_FOYER, kind: 'HOUSEHOLD' as const }],
  typesAcceptes: ['HOUSEHOLD' as const],
};

/**
 * La Cuisine est à Espace unique, l'Espace foyer : il n'y a pas de 404 croisé
 * entre Espaces personnels à prouver (ADR 0030). On prouve au contraire que
 * les deux Comptes partagent le même stock.
 *
 * La campagne partage sa base entre les fichiers, et chaque Ingrédient n'a
 * qu'une ligne : chaque test pose ses propres Ingrédients, et ne lit du stock
 * que les lignes qu'il a posées.
 */
describe('Stock domestique', () => {
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

  describe('PUT /pantry-items/:ingredientId', () => {
    it("crée la ligne d'un Ingrédient absent du stock, conforme au contrat", async () => {
      const lait = await ingredient('Lait (stock)', 'MILLILITER');

      const reponse = await request(app.getHttpServer())
        .put(`/api/pantry-items/${lait.id}`)
        .set('Cookie', jeu.a.session)
        .send({ quantity: 1500, expiresOn: '2026-10-24' })
        .expect(200)
        .expect(conformeA(UNE_LIGNE));

      expect(reponse.body).toMatchObject({
        ingredient: {
          id: lait.id,
          displayName: 'Lait (stock)',
          canonicalUnit: 'MILLILITER',
        },
        quantity: 1500,
        expiresOn: '2026-10-24',
      });
    });

    it('remplace la quantité et la péremption de la ligne en place, sans en créer une autre', async () => {
      const farine = await ingredient('Farine (stock)');
      const premiere = await corriger(farine.id, {
        quantity: 1000,
        expiresOn: '2027-01-10',
      });

      const corrigee = await corriger(farine.id, { quantity: 250.5 });

      expect(corrigee).toMatchObject({
        id: premiere.id,
        quantity: 250.5,
        expiresOn: null,
      });
      expect(await lignesDe([farine.id])).toHaveLength(1);
    });

    it('à zéro, garde la ligne sans péremption', async () => {
      const oeufs = await ingredient('Œufs (stock)', 'PIECE');
      await corriger(oeufs.id, { quantity: 6, expiresOn: '2026-10-30' });

      const vide = await corriger(oeufs.id, {
        quantity: 0,
        expiresOn: '2026-10-30',
      });

      expect(vide).toMatchObject({ quantity: 0, expiresOn: null });
    });

    it("pose la ligne dans l'Espace foyer, quel que soit l'auteur", async () => {
      const beurre = await ingredient('Beurre (stock)');

      const ligne = (
        await request(app.getHttpServer())
          .put(`/api/pantry-items/${beurre.id}`)
          .set('Cookie', jeu.b.session)
          .send({ quantity: 250 })
          .expect(200)
      ).body as PantryItem;

      // Une requête Prisma ne part qu'à l'`await` : il se fait sous la portée.
      const enBase = await sousPortee(SOUS_L_ESPACE_FOYER, async () =>
        prisma.pantryItem.findUniqueOrThrow({ where: { id: ligne.id } }),
      );
      expect(enBase.scopeId).toBe(jeu.espaceFoyer);
    });

    it.each([
      ['une quantité négative', { quantity: -1 }, 'quantity'],
      ['une quantité absente', {}, 'quantity'],
      [
        'une quantité plus fine que le millième',
        { quantity: 0.0001 },
        'quantity',
      ],
      [
        'une péremption qui n’est pas un jour',
        { quantity: 1, expiresOn: '2026-10-24T10:00:00Z' },
        'expiresOn',
      ],
    ])('refuse en 400 %s', async (cas, saisie, champ) => {
      const sel = await ingredient(`Sel (stock, ${cas})`);

      await request(app.getHttpServer())
        .put(`/api/pantry-items/${sel.id}`)
        .set('Cookie', jeu.a.session)
        .send(saisie)
        .expect(400)
        .expect(champsEnErreur([champ]));
    });

    it('refuse en 422 un Ingrédient absent du catalogue', async () => {
      await request(app.getHttpServer())
        .put(`/api/pantry-items/${INCONNU}`)
        .set('Cookie', jeu.a.session)
        .send({ quantity: 1 })
        .expect(422)
        .expect(codeDErreur('food.unknown_ingredient'));
    });

    it('refuse en 401 une correction sans session', async () => {
      await request(app.getHttpServer())
        .put(`/api/pantry-items/${INCONNU}`)
        .send({ quantity: 1 })
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });

    it('laisse la base refuser une quantité négative, ou une péremption à zéro', async () => {
      const riz = await ingredient('Riz (stock)');

      for (const ligne of [
        { quantity: -1, expiresOn: null },
        { quantity: 0, expiresOn: new Date('2026-10-24T00:00:00Z') },
      ]) {
        await expect(
          sousPortee(SOUS_L_ESPACE_FOYER, async () =>
            prisma.pantryItem.create({
              data: {
                scopeId: ID_ESPACE_FOYER,
                ingredientId: riz.id,
                ...ligne,
              },
            }),
          ),
        ).rejects.toThrow(/PantryItem_(quantity|expiresOn)_check/);
      }
    });
  });

  describe('GET /pantry-items', () => {
    it("rend le même stock aux deux Comptes, par ordre alphabétique d'Ingrédient", async () => {
      const yaourt = await ingredient('Yaourt (stock)', 'PIECE');
      const creme = await ingredient('Crème (stock)', 'MILLILITER');
      await corriger(yaourt.id, { quantity: 4, expiresOn: '2026-10-22' });
      await corriger(creme.id, { quantity: 200 });

      for (const compte of [jeu.a, jeu.b]) {
        const reponse = await request(app.getHttpServer())
          .get('/api/pantry-items')
          .set('Cookie', compte.session)
          .expect(200)
          .expect(conformeA(DES_LIGNES));

        const lignes = (reponse.body as PantryItem[]).filter(({ ingredient }) =>
          [yaourt.id, creme.id].includes(ingredient.id),
        );
        expect(
          lignes.map(({ ingredient, quantity, expiresOn }) => [
            ingredient.displayName,
            quantity,
            expiresOn,
          ]),
        ).toEqual([
          ['Crème (stock)', 200, null],
          ['Yaourt (stock)', 4, '2026-10-22'],
        ]);
      }
    });

    it('refuse en 401 une lecture sans session', async () => {
      await request(app.getHttpServer())
        .get('/api/pantry-items')
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('DELETE /pantry-items/:ingredientId', () => {
    it("retire la ligne qu'un autre Compte a posée", async () => {
      const gruyere = await ingredient('Gruyère (stock)');
      await corriger(gruyere.id, { quantity: 300 });

      await request(app.getHttpServer())
        .delete(`/api/pantry-items/${gruyere.id}`)
        .set('Cookie', jeu.b.session)
        .expect(204);

      expect(await lignesDe([gruyere.id])).toEqual([]);
    });

    it("refuse en 404 un Ingrédient qui n'est pas en stock", async () => {
      const parmesan = await ingredient('Parmesan (stock)');

      for (const id of [parmesan.id, INCONNU]) {
        await request(app.getHttpServer())
          .delete(`/api/pantry-items/${id}`)
          .set('Cookie', jeu.a.session)
          .expect(404)
          .expect(codeDErreur('food.pantry_item_not_found'));
      }
    });

    it('refuse en 401 une suppression sans session', async () => {
      await request(app.getHttpServer())
        .delete(`/api/pantry-items/${INCONNU}`)
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  async function corriger(
    ingredientId: string,
    saisie: Record<string, unknown>,
  ): Promise<PantryItem> {
    const reponse = await request(app.getHttpServer())
      .put(`/api/pantry-items/${ingredientId}`)
      .set('Cookie', jeu.a.session)
      .send(saisie)
      .expect(200);
    return reponse.body as PantryItem;
  }

  async function lignesDe(ingredientIds: string[]): Promise<PantryItem[]> {
    const reponse = await request(app.getHttpServer())
      .get('/api/pantry-items')
      .set('Cookie', jeu.a.session)
      .expect(200);
    return (reponse.body as PantryItem[]).filter(({ ingredient }) =>
      ingredientIds.includes(ingredient.id),
    );
  }

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
});
