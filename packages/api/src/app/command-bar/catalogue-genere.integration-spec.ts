import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  type AiTracePage,
  type CommandResolution,
  zCommandResolution,
} from '@personal-os/contracts';
import request from 'supertest';
import { conformeA } from '../../../test/conforme';
import {
  demarrerFauxAuthentik,
  type FauxAuthentik,
} from '../../../test/faux-authentik';
import {
  poserLeJeuDEspaces,
  type JeuDEspaces,
} from '../../../test/jeu-d-espaces';
import { AppModule } from '../app.module';
import { FournisseurIA } from '../ai/fournisseur-ia';
import { GenerateurIAFactice } from '../ai/generateur-ia.factice';
import { catalogueGenere } from './catalogue/catalogue';
import { BUT_RESOLUTION } from './resolution/resoudre';

const REDIRECT_URI = 'http://app.exemple.test/api/auth/callback';
const DASHBOARD_URL = 'http://app.exemple.test/';
const ADRESSE_A = 'a@exemple.test';
const ADRESSE_B = 'b@exemple.test';

/** Ce que le modèle propose pour une phrase : des paramètres, écrits en JSON. */
type Proposition = Record<string, unknown>;

interface Exemple {
  phrase: string;
  /** Ce que le double du modèle rend, comme le ferait le modèle. */
  propose: Proposition;
  /** La requête attendue du formulaire, une fois chaque valeur validée. */
  requete: Record<string, string>;
}

/**
 * Les quatre premières actions (CMD-4), chacune avec ses cinq exemples, et
 * pour chacun ce qu'un modèle en tire. On est le mercredi 4 novembre 2026 : le
 * lundi de la semaine est le 2.
 */
const ACTIONS: Record<string, { screen: string; exemples: Exemple[] }> = {
  EventController_creer: {
    screen: '/calendrier/evenements/nouveau',
    exemples: [
      {
        phrase: 'ajoute un rendez-vous chez le dentiste jeudi à 10 h',
        propose: {
          title: 'Dentiste',
          startsAt: '2026-11-05T09:00:00Z',
          category: 'APPOINTMENT',
        },
        requete: {
          title: 'Dentiste',
          startsAt: '2026-11-05T09:00:00Z',
          category: 'APPOINTMENT',
        },
      },
      {
        phrase: 'dîner chez Paul samedi à 20 h',
        propose: { title: 'Dîner chez Paul', startsAt: '2026-11-07T19:00:00Z' },
        requete: { title: 'Dîner chez Paul', startsAt: '2026-11-07T19:00:00Z' },
      },
      {
        phrase: 'anniversaire de maman le 12 mars',
        propose: {
          title: 'Anniversaire de maman',
          startsAt: '2027-03-11T23:00:00Z',
          category: 'BIRTHDAY',
        },
        requete: {
          title: 'Anniversaire de maman',
          startsAt: '2027-03-11T23:00:00Z',
          category: 'BIRTHDAY',
        },
      },
      {
        phrase: "échéance : déclaration d'impôts le 15 novembre",
        propose: {
          title: "Déclaration d'impôts",
          startsAt: '2026-11-14T23:00:00Z',
          category: 'DEADLINE',
        },
        requete: {
          title: "Déclaration d'impôts",
          startsAt: '2026-11-14T23:00:00Z',
          category: 'DEADLINE',
        },
      },
      {
        phrase: 'réunion de copropriété mardi de 18 h à 20 h',
        propose: {
          title: 'Réunion de copropriété',
          startsAt: '2026-11-10T17:00:00Z',
          endsAt: '2026-11-10T19:00:00Z',
        },
        requete: {
          title: 'Réunion de copropriété',
          startsAt: '2026-11-10T17:00:00Z',
          endsAt: '2026-11-10T19:00:00Z',
        },
      },
    ],
  },
  TrainingSessionController_creer: {
    screen: '/sport/seances/nouvelle',
    exemples: [
      {
        phrase: 'footing de 10 km demain à 7 h',
        propose: {
          sport: 'RUN',
          startsAt: '2026-11-05T06:00:00Z',
          plannedDistanceM: 10_000,
        },
        requete: {
          sport: 'RUN',
          startsAt: '2026-11-05T06:00:00Z',
          plannedDistanceM: '10000',
        },
      },
      {
        phrase: 'séance de muscu jeudi à 19 h',
        propose: { sport: 'STRENGTH', startsAt: '2026-11-05T18:00:00Z' },
        requete: { sport: 'STRENGTH', startsAt: '2026-11-05T18:00:00Z' },
      },
      {
        phrase: 'prévois 45 minutes de vélo samedi à 9 h',
        propose: {
          sport: 'BIKE',
          startsAt: '2026-11-07T08:00:00Z',
          plannedDurationS: 2700,
        },
        requete: {
          sport: 'BIKE',
          startsAt: '2026-11-07T08:00:00Z',
          plannedDurationS: '2700',
        },
      },
      {
        phrase: "j'ai nagé 1 500 m ce midi",
        propose: {
          sport: 'SWIM',
          status: 'DONE',
          startsAt: '2026-11-04T11:00:00Z',
          actualDistanceM: 1500,
        },
        requete: {
          sport: 'SWIM',
          status: 'DONE',
          startsAt: '2026-11-04T11:00:00Z',
          actualDistanceM: '1500',
        },
      },
      {
        phrase: 'fractionné 8 × 400 m mardi à 18 h 30',
        propose: {
          sport: 'RUN',
          startsAt: '2026-11-10T17:30:00Z',
          plannedIntent: 'Fractionné 8 × 400 m',
        },
        requete: {
          sport: 'RUN',
          startsAt: '2026-11-10T17:30:00Z',
          plannedIntent: 'Fractionné 8 × 400 m',
        },
      },
    ],
  },
  ShoppingListController_ajouter: {
    screen: '/courses/articles/nouveau',
    exemples: [
      {
        phrase: 'ajoute du lait aux courses',
        propose: { label: 'Lait' },
        requete: { label: 'Lait' },
      },
      {
        phrase: 'il faut racheter des éponges',
        propose: { label: 'Éponges' },
        requete: { label: 'Éponges' },
      },
      {
        phrase: '6 œufs sur la liste de courses',
        propose: { label: 'Œufs', quantity: 6 },
        requete: { label: 'Œufs', quantity: '6' },
      },
      {
        phrase: 'courses : papier toilette',
        propose: { label: 'Papier toilette' },
        requete: { label: 'Papier toilette' },
      },
      {
        phrase: "note qu'il n'y a plus de café",
        propose: { label: 'Café' },
        requete: { label: 'Café' },
      },
    ],
  },
  MealPlanController_lire: {
    screen: '/repas/planning',
    exemples: [
      {
        phrase: 'montre le planning des repas',
        propose: {},
        requete: {},
      },
      {
        phrase: "qu'est-ce qu'on mange cette semaine ?",
        propose: { semaine: '2026-11-02' },
        requete: { semaine: '2026-11-02' },
      },
      {
        phrase: 'planning de la semaine prochaine',
        propose: { semaine: '2026-11-09' },
        requete: { semaine: '2026-11-09' },
      },
      {
        phrase: 'ouvre les repas de la semaine du 16 novembre',
        propose: { semaine: '2026-11-16' },
        requete: { semaine: '2026-11-16' },
      },
      {
        phrase: 'on mange quoi mardi ?',
        propose: { semaine: '2026-11-02' },
        requete: { semaine: '2026-11-02' },
      },
    ],
  },
};

const CAS = Object.entries(ACTIONS).flatMap(([actionId, { screen, exemples }]) =>
  exemples.map((exemple) => ({ actionId, screen, ...exemple })),
);

/**
 * Le catalogue que le build génère, tel que l'API le sert : aucune action
 * n'y est remplacée. Chaque exemple d'une annotation se résout en l'URL de
 * son formulaire, sur le double du modèle.
 */
describe('Le catalogue généré de la barre de commande (CMD-4)', () => {
  let authentik: FauxAuthentik;
  let app: INestApplication;
  let jeu: JeuDEspaces;
  let fournisseur: GenerateurIAFactice;
  const environnementInitial = { ...process.env };

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
    fournisseur = app.get(FournisseurIA) as GenerateurIAFactice;
  });

  afterAll(async () => {
    process.env = environnementInitial;
    await app?.close();
    await authentik?.close();
  });

  function resoudre(text: string) {
    return request(app.getHttpServer())
      .post('/api/command-bar/resolve')
      .set('Cookie', jeu.a.session)
      .send({ text });
  }

  it('porte les quatre actions, chacune avec ses cinq exemples et son écran', () => {
    const catalogue = catalogueGenere();

    expect(
      catalogue.actions.map(({ id, screen, examples }) => ({
        id,
        screen,
        examples,
      })),
    ).toEqual(
      expect.arrayContaining(
        Object.entries(ACTIONS).map(([id, { screen, exemples }]) => ({
          id,
          screen,
          examples: exemples.map(({ phrase }) => phrase),
        })),
      ),
    );
  });

  it.each(CAS)(
    '$actionId : « $phrase » ouvre son formulaire prérempli',
    async ({ actionId, screen, phrase, propose, requete }) => {
      fournisseur.programmer(BUT_RESOLUTION, {
        actionId,
        params: Object.entries(propose).map(([name, valeur]) => ({
          name,
          value: JSON.stringify(valeur),
        })),
        plusProche: null,
      });

      const reponse = await resoudre(phrase)
        .expect(200)
        .expect(conformeA(zCommandResolution));

      const resolution = reponse.body as CommandResolution;
      expect(resolution).toMatchObject({ kind: 'action', ignored: [] });
      const url = new URL(
        resolution.kind === 'action' ? resolution.url : '',
        DASHBOARD_URL,
      );
      expect(url.pathname).toBe(screen);
      expect(Object.fromEntries(url.searchParams)).toEqual(requete);
    },
  );

  /**
   * Une semaine que le schéma du champ refuse est écartée par son nom, que
   * le planning signale ; une date qui n'est pas un lundi passe le catalogue,
   * et c'est le planning qui la refuse et la signale (`semaineEcartee`).
   */
  it.each([
    { semaine: 'invalide', requete: {}, ignored: ['semaine'] },
    {
      semaine: '2026-11-17',
      requete: { semaine: '2026-11-17' },
      ignored: [],
    },
  ])(
    'MealPlanController_lire : la semaine « $semaine » mène au planning, qui la signale',
    async ({ semaine, requete, ignored }) => {
      fournisseur.programmer(BUT_RESOLUTION, {
        actionId: 'MealPlanController_lire',
        params: [{ name: 'semaine', value: JSON.stringify(semaine) }],
        plusProche: null,
      });

      const reponse = await resoudre('ouvre le planning de la semaine 47')
        .expect(200)
        .expect(conformeA(zCommandResolution));

      const resolution = reponse.body as CommandResolution;
      expect(resolution).toMatchObject({ kind: 'action', ignored });
      const url = new URL(
        resolution.kind === 'action' ? resolution.url : '',
        DASHBOARD_URL,
      );
      expect(url.pathname).toBe('/repas/planning');
      expect(Object.fromEntries(url.searchParams)).toEqual(requete);
    },
  );

  it("propose au modèle chaque action avec ses exemples, sans l'Espace ni la liste visée", async () => {
    fournisseur.programmer(BUT_RESOLUTION, {
      actionId: null,
      params: [],
      plusProche: null,
    });
    await resoudre('une commande pour lire la demande').expect(200);

    const traces = (
      await request(app.getHttpServer())
        .get('/api/ai-traces')
        .set('Cookie', jeu.a.session)
        .expect(200)
    ).body as AiTracePage;
    const trace = traces.items.find(({ purpose }) => purpose === BUT_RESOLUTION);
    const lue = await request(app.getHttpServer())
      .get(`/api/ai-traces/${trace?.id}`)
      .set('Cookie', jeu.a.session)
      .expect(200);
    // La trace garde la demande telle qu'elle est partie : du JSON.
    const { catalogue } = JSON.parse(lue.body.input) as {
      catalogue: { id: string; examples: string[]; params: object }[];
    };

    for (const [id, { exemples }] of Object.entries(ACTIONS)) {
      const action = catalogue.find((proposee) => proposee.id === id);
      expect(action?.examples).toEqual(exemples.map(({ phrase }) => phrase));
      expect(Object.keys(action?.params ?? {})).not.toContain('scopeId');
      expect(Object.keys(action?.params ?? {})).not.toContain('id');
    }
  });
});
