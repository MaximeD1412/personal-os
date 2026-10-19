import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  zAiTrace,
  zAiTracePage,
  zAiTraceSummary,
  type AiTrace,
  type AiTracePage,
} from '@personal-os/contracts';
import request from 'supertest';
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
import { ModuleEssaiIA } from '../../../test/module-ia';
import { AppModule } from '../app.module';
import { FournisseurIA } from './fournisseur-ia';
import { GenerateurIAFactice } from './generateur-ia.factice';

const REDIRECT_URI = 'http://app.exemple.test/api/auth/callback';
const DASHBOARD_URL = 'http://app.exemple.test/';
const ADRESSE_A = 'a@exemple.test';
const ADRESSE_B = 'b@exemple.test';

/** Une trace exactement conforme au contrat, sans un champ de plus. */
const UNE_TRACE = zAiTrace.strict();
const UNE_PAGE = zAiTracePage
  .extend({ items: zAiTraceSummary.strict().array() })
  .strict();

/**
 * Un appel coûte 10 centimes quand le double annonce 100 000 jetons d'entrée,
 * et le plafond du mois est de 10 centimes : le seul appel qui en annonce
 * atteint le plafond. Tous les autres sont gratuits.
 */
const ENVIRONNEMENT_IA = {
  AI_MONTHLY_BUDGET_CENTS: '10',
  AI_PRICE_INPUT_PER_MTOK_CENTS: '100',
  AI_PRICE_OUTPUT_PER_MTOK_CENTS: '0',
};

/**
 * Le port IA de bout en bout, sur le double de test : aucun appel ne quitte
 * la machine. La route d'essai tient la place des modules qui appelleront le
 * modèle ; les traces se lisent par les routes de production.
 *
 * Le module n'accepte que l'Espace foyer, le seul que les deux Comptes
 * partagent : il n'y a pas d'objet personnel dont prouver le 404 (ADR 0030).
 */
describe('Traces IA', () => {
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
    Object.assign(process.env, ENVIRONNEMENT_IA);

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, ModuleEssaiIA],
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

  describe('Le double de test', () => {
    it('remplace le fournisseur hors production : aucun appel au réseau', () => {
      expect(fournisseur).toBeInstanceOf(GenerateurIAFactice);
    });
  });

  describe('Chaque appel laisse une trace', () => {
    it('rend la valeur validée et la trace de son appel, consultable', async () => {
      fournisseur.programmer('essai.trace', { plat: 'Gratin' });

      const generation = await generer(
        jeu.a,
        'essai.trace',
        'Un plat pour lundi.',
      ).expect(201);

      expect(generation.body.valeur).toEqual({ plat: 'Gratin' });

      const trace = await request(app.getHttpServer())
        .get(`/api/ai-traces/${generation.body.traceId}`)
        .set('Cookie', jeu.a.session)
        .expect(200)
        .expect(conformeA(UNE_TRACE));

      expect(trace.body as AiTrace).toMatchObject({
        id: generation.body.traceId,
        scopeId: jeu.espaceFoyer,
        purpose: 'essai.trace',
        model: 'factice',
        system: 'Tu proposes un plat.',
        input: 'Un plat pour lundi.',
        output: '{"plat":"Gratin"}',
        costCents: 0,
      });
    });

    it("la rend à l'autre Compte du Foyer", async () => {
      fournisseur.programmer('essai.partage', { plat: 'Soupe' });
      const generation = await generer(
        jeu.a,
        'essai.partage',
        'Un plat.',
      ).expect(201);

      await request(app.getHttpServer())
        .get(`/api/ai-traces/${generation.body.traceId}`)
        .set('Cookie', jeu.b.session)
        .expect(200);
    });

    it('rejette en 502 une sortie hors schéma, après une nouvelle tentative tracée', async () => {
      fournisseur.programmerTexte('essai.invalide', 'Voici un gratin !');
      fournisseur.programmer('essai.invalide', { plat: 42 });

      await generer(jeu.a, 'essai.invalide', 'Un plat.')
        .expect(502)
        .expect(codeDErreur('ai.invalid_output'));

      const journal = await lirePage({ limit: 2 });
      expect(journal.items.map(({ purpose }) => purpose)).toEqual([
        'essai.invalide',
        'essai.invalide',
      ]);
    });
  });

  describe('GET /ai-traces', () => {
    it('rend le journal des plus récentes aux plus anciennes, page par page', async () => {
      const posees: string[] = [];
      for (const plat of ['Un', 'Deux', 'Trois']) {
        fournisseur.programmer('essai.journal', { plat });
        const generation = await generer(jeu.a, 'essai.journal', plat).expect(
          201,
        );
        posees.push(generation.body.traceId);
      }

      const premiere = await request(app.getHttpServer())
        .get('/api/ai-traces')
        .query({ limit: 2 })
        .set('Cookie', jeu.a.session)
        .expect(200)
        .expect(conformeA(UNE_PAGE));
      const page = premiere.body as AiTracePage;
      expect(page.items).toHaveLength(2);
      expect(page.nextCursor).toBe(page.items[1].id);

      const suivante = await lirePage({
        limit: 2,
        cursor: page.nextCursor ?? '',
      });

      const lues = [...page.items, ...suivante.items].map(({ id }) => id);
      expect(lues.slice(0, 3)).toEqual([...posees].reverse());
      expect(new Set(lues).size).toBe(lues.length);
    });

    it('lit 50 traces par défaut', async () => {
      const page = await lirePage({});

      expect(page.items.length).toBeLessThanOrEqual(50);
    });

    it("ne donne plus de curseur quand le journal s'arrête", async () => {
      const page = await lirePage({ limit: 100 });

      expect(page.nextCursor).toBeNull();
    });

    it('refuse en 400 un curseur ou une taille de page mal formés', async () => {
      await request(app.getHttpServer())
        .get('/api/ai-traces')
        .query({ cursor: 'pas-un-uuid', limit: 0 })
        .set('Cookie', jeu.a.session)
        .expect(400)
        .expect(champsEnErreur(['cursor', 'limit']));
    });

    it('refuse en 401 une lecture sans session', async () => {
      await request(app.getHttpServer())
        .get('/api/ai-traces')
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('GET /ai-traces/:id', () => {
    it('répond 404 ai.trace_not_found pour une trace inconnue', async () => {
      await request(app.getHttpServer())
        .get('/api/ai-traces/00000000-0000-4000-8000-000000000000')
        .set('Cookie', jeu.a.session)
        .expect(404)
        .expect(codeDErreur('ai.trace_not_found'));
    });

    it('refuse en 401 une lecture sans session', async () => {
      await request(app.getHttpServer())
        .get('/api/ai-traces/00000000-0000-4000-8000-000000000000')
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  // En dernier : une fois le plafond atteint, plus aucun appel ne passe ce mois-ci.
  describe('Le plafond mensuel', () => {
    it("bloque l'appel suivant en 422 ai.budget_exceeded, sans appeler le fournisseur", async () => {
      fournisseur.programmer(
        'essai.plafond',
        { plat: 'Homard' },
        { jetonsEntree: 100_000 },
      );
      fournisseur.programmer('essai.plafond', { plat: 'Jamais servi' });

      const couteuse = await generer(
        jeu.a,
        'essai.plafond',
        'Un plat cher.',
      ).expect(201);
      const trace = await request(app.getHttpServer())
        .get(`/api/ai-traces/${couteuse.body.traceId}`)
        .set('Cookie', jeu.a.session)
        .expect(200);
      expect(trace.body.costCents).toBe(10);

      await generer(jeu.b, 'essai.plafond', 'Encore un.')
        .expect(422)
        .expect(codeDErreur('ai.budget_exceeded'));

      const journal = await lirePage({ limit: 1 });
      expect(journal.items[0].id).toBe(couteuse.body.traceId);
    });
  });

  function generer(compte: JeuDEspaces['a'], but: string, message: string) {
    return request(app.getHttpServer())
      .post('/api/essai-ia')
      .set('Cookie', compte.session)
      .send({ but, message });
  }

  async function lirePage(
    query: Record<string, string | number>,
  ): Promise<AiTracePage> {
    const reponse = await request(app.getHttpServer())
      .get('/api/ai-traces')
      .query(query)
      .set('Cookie', jeu.a.session)
      .expect(200);

    return reponse.body;
  }
});
