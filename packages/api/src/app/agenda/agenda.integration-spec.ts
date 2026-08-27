import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  CHAMPS_D_ENTREE_D_AGENDA,
  SOURCE_CALENDRIER,
  type AgendaItem,
  type Event,
} from '@personal-os/contracts';
import request from 'supertest';
import {
  ENTREE_FACTICE,
  ModuleFactice,
  SOURCE_FACTICE,
} from '../../../test/contributeur-factice';
import {
  demarrerFauxAuthentik,
  type FauxAuthentik,
} from '../../../test/faux-authentik';
import {
  poserLeJeuDEspaces,
  type JeuDEspaces,
} from '../../../test/jeu-d-espaces';
import { AppModule } from '../app.module';

const REDIRECT_URI = 'http://app.exemple.test/api/auth/callback';
const DASHBOARD_URL = 'http://app.exemple.test/';
const ADRESSE_A = 'a@exemple.test';
const ADRESSE_B = 'b@exemple.test';

/** Mars 2028 : une fenêtre qu'aucune autre campagne n'occupe. */
const PERIODE = {
  from: '2028-03-01T00:00:00.000Z',
  to: '2028-03-31T23:59:59.999Z',
};

describe('Agenda', () => {
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

    // Le module factice n'est monté que par cette campagne : l'Agenda de
    // production ne le connaît pas, et ne le connaîtra jamais.
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, ModuleFactice],
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

  describe('La période, et ce qui la rencontre', () => {
    it("rend l'Événement de la période, réduit à une référence", async () => {
      const dentiste = await creerUnEvenement(jeu.a, {
        title: 'Dentiste',
        startsAt: '2028-03-14T09:30:00.000Z',
        category: 'APPOINTMENT',
        reminderLeadMinutes: 60,
        scopeId: jeu.a.espacePersonnel,
      });

      const entree = (await lister(jeu.a)).find(
        ({ sourceId }) => sourceId === dentiste.id,
      );

      expect(entree).toEqual({
        source: SOURCE_CALENDRIER,
        sourceId: dentiste.id,
        title: 'Dentiste',
        startsAt: '2028-03-14T09:30:00.000Z',
        endsAt: null,
        status: 'PLANNED',
      });
    });

    it("ne laisse passer aucun attribut métier de l'objet d'origine", async () => {
      for (const entree of await lister(jeu.a)) {
        expect(Object.keys(entree).sort()).toEqual(
          [...CHAMPS_D_ENTREE_D_AGENDA].sort(),
        );
      }
    });

    it("écarte l'Événement qui ne rencontre pas la période", async () => {
      const plusTard = await creerUnEvenement(jeu.a, {
        title: 'Bien après',
        startsAt: '2028-06-01T09:00:00.000Z',
        category: 'OTHER',
        scopeId: jeu.a.espacePersonnel,
      });

      expect(
        (await lister(jeu.a)).map(({ sourceId }) => sourceId),
      ).not.toContain(plusTard.id);
    });

    it("retient l'Événement commencé avant la période mais qui la traverse", async () => {
      const vacances = await creerUnEvenement(jeu.a, {
        title: 'Vacances à cheval',
        startsAt: '2028-02-20T00:00:00.000Z',
        endsAt: '2028-03-05T00:00:00.000Z',
        category: 'OTHER',
        scopeId: jeu.espaceFoyer,
      });

      expect((await lister(jeu.a)).map(({ sourceId }) => sourceId)).toContain(
        vacances.id,
      );
    });

    it('refuse une demande sans période', async () => {
      await request(app.getHttpServer())
        .get('/api/agenda')
        .set('Cookie', jeu.a.session)
        .expect(400);

      await request(app.getHttpServer())
        .get(`/api/agenda?from=${PERIODE.from}`)
        .set('Cookie', jeu.a.session)
        .expect(400);
    });
  });

  describe("Ce qu'un Compte ne voit pas", () => {
    it("n'expose jamais l'Événement de l'Espace personnel de l'autre", async () => {
      const sien = await creerUnEvenement(jeu.b, {
        title: 'Secret de B',
        startsAt: '2028-03-18T10:00:00.000Z',
        category: 'APPOINTMENT',
        scopeId: jeu.b.espacePersonnel,
      });

      expect(
        (await lister(jeu.a)).map(({ sourceId }) => sourceId),
      ).not.toContain(sien.id);
      expect((await lister(jeu.b)).map(({ sourceId }) => sourceId)).toContain(
        sien.id,
      );
    });

    it("rend aux deux Comptes l'Événement de l'Espace foyer", async () => {
      const commun = await creerUnEvenement(jeu.a, {
        title: 'Vacances communes',
        startsAt: '2028-03-22T10:00:00.000Z',
        category: 'OTHER',
        scopeId: jeu.espaceFoyer,
      });

      for (const compte of [jeu.a, jeu.b]) {
        expect(
          (await lister(compte)).map(({ sourceId }) => sourceId),
        ).toContain(commun.id);
      }
    });

    it("n'expose rien sans session", async () => {
      await request(app.getHttpServer())
        .get(`/api/agenda?from=${PERIODE.from}&to=${PERIODE.to}`)
        .expect(401);
    });
  });

  describe("L'Agenda ne s'écrit pas", () => {
    it.each(['post', 'patch', 'put', 'delete'] as const)(
      "n'offre aucun %s",
      async (verbe) => {
        const reponse = await request(app.getHttpServer())
          [verbe]('/api/agenda')
          .set('Cookie', jeu.a.session)
          .send({ title: 'Écrit depuis l’Agenda' });

        expect(reponse.status).toBe(404);
      },
    );

    it("n'offre pas davantage d'écriture sur une entrée", async () => {
      const [entree] = await lister(jeu.a);

      const reponse = await request(app.getHttpServer())
        .patch(`/api/agenda/${entree.sourceId}`)
        .set('Cookie', jeu.a.session)
        .send({ title: 'Déplacé depuis l’Agenda' });

      expect(reponse.status).toBe(404);
    });
  });

  describe("Une source que l'Agenda ne connaît pas", () => {
    it("rend les entrées d'un module qui s'est enregistré tout seul", async () => {
      const entrees = await lister(jeu.a);

      expect(entrees).toContainEqual(ENTREE_FACTICE);
    });

    it('les mêle aux autres, dans le même ordre du temps', async () => {
      const entrees = await lister(jeu.a);
      const dates = entrees.map(({ startsAt }) => startsAt);

      expect(dates).toEqual([...dates].sort());
      expect(entrees.map(({ source }) => source)).toContain(SOURCE_FACTICE);
      expect(entrees.map(({ source }) => source)).toContain(SOURCE_CALENDRIER);
    });
  });

  async function creerUnEvenement(
    compte: JeuDEspaces['a'],
    saisie: Record<string, unknown>,
  ): Promise<Event> {
    const reponse = await request(app.getHttpServer())
      .post('/api/events')
      .set('Cookie', compte.session)
      .send(saisie)
      .expect(201);

    return reponse.body;
  }

  async function lister(compte: JeuDEspaces['a']): Promise<AgendaItem[]> {
    const reponse = await request(app.getHttpServer())
      .get(`/api/agenda?from=${PERIODE.from}&to=${PERIODE.to}`)
      .set('Cookie', compte.session)
      .expect(200);

    return reponse.body;
  }
});
