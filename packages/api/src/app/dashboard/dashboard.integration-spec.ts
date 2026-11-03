import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  zHousehold,
  zModuleSummary,
  zTodo,
  type Event,
  type Ingredient,
  type MealPlan,
  type MealPlanEntry,
  type ModuleSummary,
  type ShoppingList,
  type ShoppingListItem,
  type Todo,
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
import { conformeA } from '../../../test/conforme';
import {
  MODULE_FACTICE,
  ModuleResumeFactice,
  ResumeurFactice,
} from '../../../test/resumeur-factice';
import { AppModule } from '../app.module';
import { Horloge } from './horloge';

const REDIRECT_URI = 'http://app.exemple.test/api/auth/callback';
const DASHBOARD_URL = 'http://app.exemple.test/';
const ADRESSE_A = 'a@exemple.test';
const ADRESSE_B = 'b@exemple.test';

/**
 * L'instant de toutes les lectures : le mercredi 8 mars 2034, 10 h à Paris.
 * Aucune autre campagne n'écrit en 2034 ; ce qui en reste dans la base
 * partagée (des listes encore ouvertes, du stock déjà périmé) peut apparaître
 * dans les réponses, et chaque test ne regarde donc que ce qu'il a posé.
 */
const MAINTENANT = new Date('2034-03-08T09:00:00.000Z');
const LUNDI = '2034-03-06';

const UN_A_FAIRE = zTodo.strict();
const UN_RESUME = zModuleSummary
  .extend({
    indicators: z.array(zModuleSummary.shape.indicators.element.strict()),
    signals: z.array(zModuleSummary.shape.signals.element.strict()),
  })
  .strict();

describe('Tableau de bord', () => {
  let authentik: FauxAuthentik;
  let app: INestApplication;
  let jeu: JeuDEspaces;
  let prisma: PrismaService;
  let compteA: string;
  let semaines = 0;

  beforeAll(async () => {
    authentik = await demarrerFauxAuthentik();

    process.env['OIDC_ISSUER'] = authentik.issuer;
    process.env['OIDC_CLIENT_ID'] = 'personal-os';
    process.env['OIDC_CLIENT_SECRET'] = 'secret-de-test';
    process.env['OIDC_REDIRECT_URI'] = REDIRECT_URI;
    process.env['DASHBOARD_URL'] = DASHBOARD_URL;
    process.env['AUTH_ALLOWED_EMAILS'] = `${ADRESSE_A},${ADRESSE_B}`;

    // Le module factice n'est monté que par cette campagne : le tableau de
    // bord de production ne le connaît pas, et ne le connaîtra jamais.
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, ModuleResumeFactice],
    })
      .overrideProvider(Horloge)
      .useValue({ maintenant: () => MAINTENANT })
      .compile();

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
    compteA = foyer.members[0].id;
  });

  afterAll(async () => {
    await app?.close();
    await authentik?.close();
  });

  describe('Un module que le tableau de bord ne connaît pas', () => {
    it('rend son signal comme un À faire, conforme au contrat, avec le lien qui le résout', async () => {
      await request(app.getHttpServer())
        .get('/api/dashboard/todos')
        .set('Cookie', jeu.a.session)
        .expect(200)
        .expect(conformeA(z.array(UN_A_FAIRE)))
        .expect(({ body }) => {
          expect(body).toContainEqual({
            module: MODULE_FACTICE,
            kind: `${MODULE_FACTICE}.situation`,
            ref: 'objet-factice-1',
            label: "Une situation d'un module qui n'existe pas",
            dueOn: '2000-01-01',
            link: '/module-factice/objet-factice-1',
          });
        });
    });

    it("rend son résumé, conforme au contrat, demandé à l'instant de l'horloge", async () => {
      const resumeur = app.get(ResumeurFactice);

      await request(app.getHttpServer())
        .get('/api/dashboard/summaries')
        .set('Cookie', jeu.a.session)
        .expect(200)
        .expect(conformeA(z.array(UN_RESUME)))
        .expect(({ body }) => {
          expect(
            (body as ModuleSummary[]).find(
              ({ module }) => module === MODULE_FACTICE,
            ),
          ).toEqual({
            module: MODULE_FACTICE,
            indicators: [{ key: 'objets', label: 'Objets factices', value: 3 }],
            signals: [expect.objectContaining({ ref: 'objet-factice-1' })],
          });
        });
      expect(resumeur.instants.at(-1)).toEqual(MAINTENANT);
    });

    it("trie les À faire par échéance, la plus proche d'abord", async () => {
      const todos = await aFaire(jeu.a);
      const echeances = todos
        .map(({ dueOn }) => dueOn)
        .filter((dueOn) => dueOn !== undefined);

      expect(echeances).toEqual([...echeances].sort());
      expect(todos[0].ref).toBe('objet-factice-1');
    });
  });

  describe('La Cuisine', () => {
    describe('un planning de la semaine dont des repas attendent une décision', () => {
      it('produit un À faire vers le planning, qui disparaît quand on décide', async () => {
        const planning = await unPlanning(LUNDI);
        const jeudi = await ajouter(planning, 3);
        const mardi = await ajouter(planning, 1);
        await proposer(planning, jeudi);
        await proposer(planning, mardi);

        expect(await aFaireDe(jeu.a, planning.id)).toEqual([
          {
            module: 'food',
            kind: 'food.meal_plan_pending_decisions',
            ref: planning.id,
            label: '2 repas attendent une décision',
            dueOn: '2034-03-07',
            link: `/repas/planning?semaine=${LUNDI}`,
          },
        ]);

        await decider(planning, mardi, 'APPROVED');
        expect(await aFaireDe(jeu.b, planning.id)).toEqual([
          expect.objectContaining({
            label: '1 repas attend une décision',
            dueOn: '2034-03-09',
          }),
        ]);

        await decider(planning, jeudi, 'REFUSED');
        expect(await aFaireDe(jeu.a, planning.id)).toEqual([]);
      });

      it("ne produit rien pour une autre semaine que celle de l'horloge", async () => {
        const suivante = await unPlanning('2034-03-13');
        await proposer(suivante, await ajouter(suivante, 0));

        expect(await aFaireDe(jeu.a, suivante.id)).toEqual([]);
      });
    });

    describe('une liste de courses ouverte', () => {
      it('produit un À faire vers la liste, qui disparaît quand elle est close', async () => {
        const liste = await uneListe(['Pain', 'Beurre']);

        expect(await aFaireDe(jeu.a, liste.id)).toEqual([
          {
            module: 'food',
            kind: 'food.shopping_list_open',
            ref: liste.id,
            label: 'Liste de courses en cours : 2 articles restants',
            link: `/courses/${liste.id}`,
          },
        ]);

        await clore(liste);
        expect(await aFaireDe(jeu.a, liste.id)).toEqual([]);
      });

      it('compte ses articles restants, sans ceux qui sont cochés', async () => {
        const avant = await articlesRestants();
        const liste = await uneListe(['Lait', 'Œufs', 'Farine']);
        expect(await articlesRestants()).toBe(avant + 3);

        await cocher(liste, liste.items[0]);
        expect(await articlesRestants()).toBe(avant + 2);
        expect(await aFaireDe(jeu.a, liste.id)).toEqual([
          expect.objectContaining({
            label: 'Liste de courses en cours : 2 articles restants',
          }),
        ]);

        await clore(liste);
        expect(await articlesRestants()).toBe(avant);
      });
    });

    describe('un ingrédient qui périme dans les trois jours', () => {
      it("produit un À faire vers le stock, qui disparaît quand sa péremption s'éloigne", async () => {
        const yaourt = await ingredient('Yaourt (tableau de bord)');
        await stocker(yaourt, 4, '2034-03-11');

        expect(await aFaireDe(jeu.a, yaourt.id)).toEqual([
          {
            module: 'food',
            kind: 'food.pantry_item_expiring',
            ref: yaourt.id,
            label: 'Yaourt (tableau de bord) périme le 11 mars',
            dueOn: '2034-03-11',
            link: '/repas/stock',
          },
        ]);

        await stocker(yaourt, 4, '2034-03-12');
        expect(await aFaireDe(jeu.a, yaourt.id)).toEqual([]);
      });

      it("signale aussi l'ingrédient déjà périmé, tant qu'il en reste", async () => {
        const creme = await ingredient('Crème (tableau de bord)');
        await stocker(creme, 1, '2034-03-07');

        expect(await aFaireDe(jeu.a, creme.id)).toEqual([
          expect.objectContaining({
            label: 'Crème (tableau de bord) a périmé le 7 mars',
            dueOn: '2034-03-07',
          }),
        ]);

        await stocker(creme, 0, '2034-03-07');
        expect(await aFaireDe(jeu.a, creme.id)).toEqual([]);
      });

      it('ne signale pas un ingrédient sans péremption', async () => {
        const sel = await ingredient('Sel (tableau de bord)');
        await stocker(sel, 500, null);

        expect(await aFaireDe(jeu.a, sel.id)).toEqual([]);
      });
    });
  });

  describe('Le Calendrier', () => {
    describe('une Échéance sans rappel, dans les sept jours', () => {
      it("produit un À faire vers l'Événement, qui disparaît quand ce n'est plus une Échéance", async () => {
        const impots = await creerUnEvenement(jeu.a, {
          title: 'Impôts (tableau de bord)',
          startsAt: '2034-03-12T10:00:00.000Z',
          category: 'DEADLINE',
          scopeId: jeu.a.espacePersonnel,
        });

        expect(await aFaireDe(jeu.a, impots.id)).toEqual([
          {
            module: 'calendar',
            kind: 'calendar.deadline_due',
            ref: impots.id,
            label: 'Échéance : Impôts (tableau de bord)',
            dueOn: '2034-03-12',
            link: `/calendrier/evenements/${impots.id}?mois=2034-03`,
          },
        ]);

        await request(app.getHttpServer())
          .patch(`/api/events/${impots.id}`)
          .set('Cookie', jeu.a.session)
          .send({ category: 'APPOINTMENT' })
          .expect(200);
        expect(await aFaireDe(jeu.a, impots.id)).toEqual([]);
      });

      it("ne parvient pas à l'autre Compte quand elle est dans un Espace personnel", async () => {
        const personnelle = await creerUnEvenement(jeu.a, {
          title: 'Assurance (tableau de bord)',
          startsAt: '2034-03-10T08:00:00.000Z',
          category: 'DEADLINE',
          scopeId: jeu.a.espacePersonnel,
        });

        expect(await aFaireDe(jeu.a, personnelle.id)).toHaveLength(1);
        expect(await aFaireDe(jeu.b, personnelle.id)).toEqual([]);
      });

      it("parvient aux deux Comptes quand elle est dans l'Espace foyer", async () => {
        const loyer = await creerUnEvenement(jeu.a, {
          title: 'Loyer (tableau de bord)',
          startsAt: '2034-03-14T08:00:00.000Z',
          category: 'DEADLINE',
          scopeId: jeu.espaceFoyer,
        });

        expect(await aFaireDe(jeu.a, loyer.id)).toHaveLength(1);
        expect(await aFaireDe(jeu.b, loyer.id)).toHaveLength(1);
      });

      it('ne signale ni une Échéance passée, ni une Échéance au-delà de sept jours', async () => {
        const passee = await creerUnEvenement(jeu.a, {
          title: 'Passée (tableau de bord)',
          startsAt: '2034-03-08T08:00:00.000Z',
          category: 'DEADLINE',
          scopeId: jeu.a.espacePersonnel,
        });
        const lointaine = await creerUnEvenement(jeu.a, {
          title: 'Lointaine (tableau de bord)',
          startsAt: '2034-03-15T10:00:00.000Z',
          category: 'DEADLINE',
          scopeId: jeu.a.espacePersonnel,
        });

        expect(await aFaireDe(jeu.a, passee.id)).toEqual([]);
        expect(await aFaireDe(jeu.a, lointaine.id)).toEqual([]);
      });

      it("signale chaque occurrence d'une série, chacune vers la sienne", async () => {
        const releve = await creerUnEvenement(jeu.a, {
          title: 'Relevé (tableau de bord)',
          startsAt: '2034-03-01T10:00:00.000Z',
          category: 'DEADLINE',
          recurrence: { freq: 'DAILY', interval: 4 },
          scopeId: jeu.a.espacePersonnel,
        });

        const todos = (await aFaire(jeu.a)).filter(({ ref }) =>
          ref.startsWith(releve.id),
        );
        expect(todos.map(({ dueOn }) => dueOn)).toEqual([
          '2034-03-09',
          '2034-03-13',
        ]);
        expect(todos[0]).toEqual({
          module: 'calendar',
          kind: 'calendar.deadline_due',
          ref: `${releve.id}@2034-03-09T10:00:00.000Z`,
          label: 'Échéance : Relevé (tableau de bord)',
          dueOn: '2034-03-09',
          link: `/calendrier/evenements/${releve.id}?mois=2034-03&occurrence=2034-03-09T10%3A00%3A00.000Z`,
        });
      });
    });

    describe('une Échéance dont le délai de rappel est atteint', () => {
      it("ne se signale qu'une fois son rappel atteint, et non sept jours avant", async () => {
        const declaration = await creerUnEvenement(jeu.a, {
          title: 'Déclaration (tableau de bord)',
          startsAt: '2034-03-12T10:00:00.000Z',
          category: 'DEADLINE',
          reminderLeadMinutes: 30,
          scopeId: jeu.a.espacePersonnel,
        });
        const imminente = await creerUnEvenement(jeu.a, {
          title: 'Imminente (tableau de bord)',
          startsAt: '2034-03-08T09:20:00.000Z',
          category: 'DEADLINE',
          reminderLeadMinutes: 30,
          scopeId: jeu.a.espacePersonnel,
        });

        expect(await aFaireDe(jeu.a, declaration.id)).toEqual([]);
        expect(await aFaireDe(jeu.a, imminente.id)).toHaveLength(1);

        // Quatre jours avant, un rappel d'une semaine est atteint.
        await request(app.getHttpServer())
          .patch(`/api/events/${declaration.id}`)
          .set('Cookie', jeu.a.session)
          .send({ reminderLeadMinutes: 10_080 })
          .expect(200);
        expect(await aFaireDe(jeu.a, declaration.id)).toHaveLength(1);
      });

      it('se signale plus de sept jours avant quand son rappel le veut', async () => {
        const renouvellement = await creerUnEvenement(jeu.a, {
          title: 'Renouvellement (tableau de bord)',
          startsAt: '2034-03-20T10:00:00.000Z',
          category: 'DEADLINE',
          reminderLeadMinutes: 20_160,
          scopeId: jeu.a.espacePersonnel,
        });

        expect(await aFaireDe(jeu.a, renouvellement.id)).toEqual([
          expect.objectContaining({ dueOn: '2034-03-20' }),
        ]);
      });

      it("mène au mois, à Paris, où tombe l'occurrence, même le mois suivant", async () => {
        // Le 31 mars à 22 h 30 UTC, c'est déjà le 1er avril à Paris.
        const cotisation = await creerUnEvenement(jeu.a, {
          title: 'Cotisation (tableau de bord)',
          startsAt: '2034-03-31T22:30:00.000Z',
          category: 'DEADLINE',
          reminderLeadMinutes: 43_200,
          recurrence: { freq: 'MONTHLY', interval: 1 },
          scopeId: jeu.a.espacePersonnel,
        });

        const todos = (await aFaire(jeu.a)).filter(({ ref }) =>
          ref.startsWith(cotisation.id),
        );
        expect(todos).toEqual([
          expect.objectContaining({
            ref: `${cotisation.id}@2034-03-31T22:30:00.000Z`,
            dueOn: '2034-04-01',
            link: `/calendrier/evenements/${cotisation.id}?mois=2034-04&occurrence=2034-03-31T22%3A30%3A00.000Z`,
          }),
        ]);
      });
    });
  });

  describe('Sans session', () => {
    it.each(['todos', 'summaries'])(
      'GET /dashboard/%s répond 401',
      async (route) => {
        await request(app.getHttpServer())
          .get(`/api/dashboard/${route}`)
          .expect(401);
      },
    );
  });

  async function aFaire(compte: CompteDeTest): Promise<Todo[]> {
    const reponse = await request(app.getHttpServer())
      .get('/api/dashboard/todos')
      .set('Cookie', compte.session)
      .expect(200);
    return reponse.body as Todo[];
  }

  async function resume(
    compte: CompteDeTest,
    module: string,
  ): Promise<ModuleSummary> {
    const reponse = await request(app.getHttpServer())
      .get('/api/dashboard/summaries')
      .set('Cookie', compte.session)
      .expect(200);
    const trouve = (reponse.body as ModuleSummary[]).find(
      (candidat) => candidat.module === module,
    );
    if (!trouve) {
      throw new Error(`Le module ${module} ne se résume pas.`);
    }
    return trouve;
  }

  function dansLeFoyer<T>(suite: () => Promise<T>): Promise<T> {
    return sousPortee(
      {
        espaces: [{ id: jeu.espaceFoyer, kind: 'HOUSEHOLD' }],
        typesAcceptes: ['HOUSEHOLD'],
      },
      suite,
    );
  }

  /** Les À faire du Compte qui portent sur cet objet. */
  async function aFaireDe(compte: CompteDeTest, ref: string): Promise<Todo[]> {
    return (await aFaire(compte)).filter((todo) => todo.ref === ref);
  }

  async function unPlanning(week: string): Promise<MealPlan> {
    const reponse = await request(app.getHttpServer())
      .get('/api/meal-plans')
      .query({ week })
      .set('Cookie', jeu.a.session)
      .expect(200);
    return reponse.body as MealPlan;
  }

  /** Un repas libre, le `jour`-ième jour de la semaine du planning. */
  async function ajouter(
    planning: MealPlan,
    jour: number,
  ): Promise<MealPlanEntry> {
    const day = new Date(`${planning.week}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() + jour);
    const reponse = await request(app.getHttpServer())
      .post(`/api/meal-plans/${planning.id}/entries`)
      .set('Cookie', jeu.a.session)
      .send({
        day: day.toISOString().slice(0, 10),
        moment: 'DINNER',
        title: 'Restaurant',
        participantIds: [compteA],
      })
      .expect(201);
    return reponse.body as MealPlanEntry;
  }

  /** Un repas proposé vient d'un Tour de génération : on le pose en base. */
  async function proposer(
    planning: MealPlan,
    repas: MealPlanEntry,
  ): Promise<void> {
    await dansLeFoyer(async () => {
      const tour = await prisma.generationRound.upsert({
        where: { mealPlanId_number: { mealPlanId: planning.id, number: 1 } },
        create: {
          mealPlanId: planning.id,
          number: 1,
          scopeId: jeu.espaceFoyer,
        },
        update: {},
      });
      await prisma.mealPlanEntry.update({
        where: { id: repas.id },
        data: { decision: 'PROPOSED', generationRoundId: tour.id },
      });
    });
  }

  async function decider(
    planning: MealPlan,
    repas: MealPlanEntry,
    decision: 'APPROVED' | 'REFUSED',
  ): Promise<void> {
    await request(app.getHttpServer())
      .post(`/api/meal-plans/${planning.id}/entries/${repas.id}/decision`)
      .set('Cookie', jeu.a.session)
      .send({ decision })
      .expect(200);
  }

  /**
   * Une liste ouverte de ces articles ajoutés à la main, produite d'un
   * planning arrêté d'une semaine de mai 2034, chaque fois une autre.
   */
  async function uneListe(libelles: string[]): Promise<ShoppingList> {
    const lundi = new Date(Date.UTC(2034, 4, 1 + 7 * semaines++));
    const planning = await unPlanning(lundi.toISOString().slice(0, 10));
    await ajouter(planning, 0);
    await request(app.getHttpServer())
      .post(`/api/meal-plans/${planning.id}/stop`)
      .set('Cookie', jeu.a.session)
      .expect(200);
    const liste = (
      await request(app.getHttpServer())
        .post(`/api/meal-plans/${planning.id}/shopping-lists`)
        .set('Cookie', jeu.a.session)
        .expect(201)
    ).body as ShoppingList;

    const items: ShoppingListItem[] = [];
    for (const label of libelles) {
      items.push(
        (
          await request(app.getHttpServer())
            .post(`/api/shopping-lists/${liste.id}/items`)
            .set('Cookie', jeu.a.session)
            .send({ label })
            .expect(201)
        ).body as ShoppingListItem,
      );
    }
    return { ...liste, items };
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

  /** La clôture vient avec CUISINE-10 : on la pose en base. */
  async function clore(liste: ShoppingList): Promise<void> {
    await dansLeFoyer(
      async () =>
        await prisma.shoppingList.update({
          where: { id: liste.id },
          data: { status: 'CLOSED', closedAt: new Date() },
        }),
    );
  }

  async function articlesRestants(): Promise<number> {
    const { indicators } = await resume(jeu.a, 'food');
    const indicateur = indicators.find(
      ({ key }) => key === 'shopping_list_remaining_items',
    );
    expect(indicateur?.label).toBe('Articles restants');
    return Number(indicateur?.value);
  }

  async function ingredient(displayName: string): Promise<Ingredient> {
    const reponse = await request(app.getHttpServer())
      .post('/api/ingredients')
      .set('Cookie', jeu.a.session)
      .send({ displayName, canonicalUnit: 'GRAM' })
      .expect(201);
    return reponse.body as Ingredient;
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

  async function creerUnEvenement(
    compte: CompteDeTest,
    saisie: Record<string, unknown>,
  ): Promise<Event> {
    const reponse = await request(app.getHttpServer())
      .post('/api/events')
      .set('Cookie', compte.session)
      .send(saisie)
      .expect(201);
    return reponse.body as Event;
  }
});
