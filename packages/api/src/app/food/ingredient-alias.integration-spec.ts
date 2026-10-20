import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  zIngredientAlias,
  zIngredientResolution,
  type Ingredient,
  type IngredientAlias,
  type IngredientResolution,
} from '@personal-os/contracts';
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

/** Un Alias, et des résolutions, exactement conformes au contrat. */
const UN_ALIAS = zIngredientAlias.strict();
const DES_RESOLUTIONS = z.array(
  z.union(zIngredientResolution.options.map((option) => option.strict())),
);

const INCONNU = '00000000-0000-4000-8000-000000000000';

/**
 * Le résolveur et les Alias sont globaux, comme le catalogue : pas de 404
 * croisé à prouver (ADR 0030). Un libellé que A rattache, B le voit résolu.
 *
 * La campagne partage sa base entre les fichiers : chaque test nomme ses
 * Ingrédients et ses libellés d'un mot qui lui est propre.
 */
describe("Résolveur d'ingrédients et Alias", () => {
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

  describe('POST /ingredients/resolve', () => {
    it('rend un résultat par libellé, dans l’ordre, conforme au contrat', async () => {
      const basilic = await creer(jeu.a, {
        displayName: 'Basilic résolu',
        canonicalUnit: 'GRAM',
      });

      const reponse = await request(app.getHttpServer())
        .post('/api/ingredients/resolve')
        .set('Cookie', jeu.a.session)
        .send({ labels: ['Fenouil introuvable zx', ' BASILIC  résolu '] })
        .expect(200)
        .expect(conformeA(DES_RESOLUTIONS));

      expect(reponse.body).toEqual([
        {
          label: 'Fenouil introuvable zx',
          unknown: true,
          suggestions: [],
        },
        { label: 'BASILIC  résolu', ingredientId: basilic.id },
      ]);
    });

    it('signale un libellé inconnu avec des suggestions', async () => {
      const jaune = await creer(jeu.a, {
        displayName: 'Ciboule jaune suggérée',
        canonicalUnit: 'PIECE',
      });

      const [resolution] = await resoudre(jeu.a, ['Ciboule rouge suggérée']);

      expect(resolution).toMatchObject({ unknown: true });
      expect((resolution as { suggestions: string[] }).suggestions).toContain(
        jaune.id,
      );
    });

    it('ne résout pas « Oignon rouge » vers « Oignon jaune » quand les deux existent', async () => {
      const rouge = await creer(jeu.a, {
        displayName: 'Oignon rouge distinct',
        canonicalUnit: 'PIECE',
      });
      await creer(jeu.a, {
        displayName: 'Oignon jaune distinct',
        canonicalUnit: 'PIECE',
      });

      expect(await resoudre(jeu.b, ['oignon ROUGE distinct'])).toEqual([
        { label: 'oignon ROUGE distinct', ingredientId: rouge.id },
      ]);
    });

    it('refuse en 400 une demande sans libellé, ou un libellé vide', async () => {
      await request(app.getHttpServer())
        .post('/api/ingredients/resolve')
        .set('Cookie', jeu.a.session)
        .send({ labels: [] })
        .expect(400)
        .expect(champsEnErreur(['labels']));

      await request(app.getHttpServer())
        .post('/api/ingredients/resolve')
        .set('Cookie', jeu.a.session)
        .send({ labels: ['Tomate', ' ?! '] })
        .expect(400)
        .expect(champsEnErreur(['labels.1']));
    });

    it('refuse en 401 une résolution sans session', async () => {
      await request(app.getHttpServer())
        .post('/api/ingredients/resolve')
        .send({ labels: ['Tomate'] })
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('POST /ingredient-aliases', () => {
    it('rattache un libellé, normalisé, conforme au contrat', async () => {
      const tomate = await creer(jeu.a, {
        displayName: 'Tomate rattachée',
        canonicalUnit: 'GRAM',
      });

      const reponse = await request(app.getHttpServer())
        .post('/api/ingredient-aliases')
        .set('Cookie', jeu.a.session)
        .send({
          label: '  Belles Tomates rattachées ',
          ingredientId: tomate.id,
        })
        .expect(201)
        .expect(conformeA(UN_ALIAS));

      expect(reponse.body).toMatchObject({
        label: 'belles tomates rattachees',
        ingredientId: tomate.id,
      });
    });

    it('fait reconnaître ensuite le même libellé, casse et accents différents', async () => {
      const tomate = await creer(jeu.a, {
        displayName: 'Tomate mémorisée',
        canonicalUnit: 'GRAM',
      });
      expect(await resoudre(jeu.a, ['Tomates concassées mémo'])).toEqual([
        expect.objectContaining({ unknown: true }),
      ]);

      await rattacher(jeu.a, 'Tomates concassées mémo', tomate.id);

      expect(await resoudre(jeu.b, ['TOMATES CONCASSEES MEMO.'])).toEqual([
        { label: 'TOMATES CONCASSEES MEMO.', ingredientId: tomate.id },
      ]);
    });

    it('rend l’Alias existant quand le libellé est déjà rattaché au même Ingrédient', async () => {
      const poireau = await creer(jeu.a, {
        displayName: 'Poireau idempotent',
        canonicalUnit: 'PIECE',
      });
      const premier = await rattacher(
        jeu.a,
        'Blanc de poireau idem',
        poireau.id,
      );

      const second = await rattacher(
        jeu.b,
        'BLANC DE POIREAU IDEM',
        poireau.id,
      );

      expect(second).toEqual(premier);
    });

    it('refuse en 400 une saisie sans libellé ni Ingrédient, champ par champ', async () => {
      await request(app.getHttpServer())
        .post('/api/ingredient-aliases')
        .set('Cookie', jeu.a.session)
        .send({})
        .expect(400)
        .expect(champsEnErreur(['label', 'ingredientId']));
    });

    it('refuse en 422 un libellé déjà rattaché à un autre Ingrédient', async () => {
      const carotte = await creer(jeu.a, {
        displayName: 'Carotte conflit',
        canonicalUnit: 'GRAM',
      });
      const navet = await creer(jeu.a, {
        displayName: 'Navet conflit',
        canonicalUnit: 'GRAM',
      });
      await rattacher(jeu.a, 'Racine orange conflit', carotte.id);

      await request(app.getHttpServer())
        .post('/api/ingredient-aliases')
        .set('Cookie', jeu.b.session)
        .send({ label: 'racine orange CONFLIT', ingredientId: navet.id })
        .expect(422)
        .expect(codeDErreur('food.alias_conflict'));
    });

    it("refuse en 422 le nom d'un autre Ingrédient, qu'un Alias masquerait", async () => {
      const oignon = await creer(jeu.a, {
        displayName: 'Oignon masqué',
        canonicalUnit: 'PIECE',
      });
      const jaune = await creer(jeu.a, {
        displayName: 'Oignon masqué jaune',
        canonicalUnit: 'PIECE',
      });

      await request(app.getHttpServer())
        .post('/api/ingredient-aliases')
        .set('Cookie', jeu.a.session)
        .send({ label: 'Oignon masqué', ingredientId: jaune.id })
        .expect(422)
        .expect(codeDErreur('food.alias_conflict'));

      expect(await resoudre(jeu.a, ['Oignon masqué'])).toEqual([
        { label: 'Oignon masqué', ingredientId: oignon.id },
      ]);
    });

    it('ne laisse pas deux rattachements simultanés viser deux Ingrédients', async () => {
      const ail = await creer(jeu.a, {
        displayName: 'Ail concurrent',
        canonicalUnit: 'PIECE',
      });
      const echalote = await creer(jeu.a, {
        displayName: 'Échalote concurrente',
        canonicalUnit: 'PIECE',
      });

      const reponses = await Promise.all([
        request(app.getHttpServer())
          .post('/api/ingredient-aliases')
          .set('Cookie', jeu.a.session)
          .send({ label: 'Gousse concurrente', ingredientId: ail.id }),
        request(app.getHttpServer())
          .post('/api/ingredient-aliases')
          .set('Cookie', jeu.b.session)
          .send({ label: 'Gousse concurrente', ingredientId: echalote.id }),
      ]);

      // L'un passe, l'autre est refusé par la règle, jamais par une 500.
      expect(reponses.map(({ status }) => status).sort()).toEqual([201, 422]);
      expect(
        await prisma.ingredientAlias.count({
          where: { label: 'gousse concurrente' },
        }),
      ).toBe(1);
    });

    it('répond 404 pour un Ingrédient inconnu', async () => {
      await request(app.getHttpServer())
        .post('/api/ingredient-aliases')
        .set('Cookie', jeu.a.session)
        .send({ label: 'Libellé orphelin', ingredientId: INCONNU })
        .expect(404)
        .expect(codeDErreur('food.ingredient_not_found'));
    });

    it('refuse en 401 un rattachement sans session', async () => {
      await request(app.getHttpServer())
        .post('/api/ingredient-aliases')
        .send({ label: 'Anonyme', ingredientId: INCONNU })
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

  async function resoudre(
    compte: CompteDeTest,
    labels: string[],
  ): Promise<IngredientResolution[]> {
    const reponse = await request(app.getHttpServer())
      .post('/api/ingredients/resolve')
      .set('Cookie', compte.session)
      .send({ labels })
      .expect(200);

    return reponse.body as IngredientResolution[];
  }

  async function rattacher(
    compte: CompteDeTest,
    label: string,
    ingredientId: string,
  ): Promise<IngredientAlias> {
    const reponse = await request(app.getHttpServer())
      .post('/api/ingredient-aliases')
      .set('Cookie', compte.session)
      .send({ label, ingredientId })
      .expect(201);

    return reponse.body as IngredientAlias;
  }
});
