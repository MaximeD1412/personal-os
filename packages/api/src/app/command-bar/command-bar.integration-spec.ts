import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  zCommandResolution,
  zUnresolvedCommand,
  zUnresolvedCommandPage,
  type CommandCatalog,
  type UnresolvedCommandPage,
} from '@personal-os/contracts';
import { PrismaService, sousPortee } from '@personal-os/database';
import request from 'supertest';
import { z } from 'zod';
import { champsEnErreur } from '../../../test/code-d-erreur';
import { conformeA } from '../../../test/conforme';
import {
  demarrerFauxAuthentik,
  type FauxAuthentik,
} from '../../../test/faux-authentik';
import {
  poserLeJeuDEspaces,
  type CompteDeTest,
  type JeuDEspaces,
} from '../../../test/jeu-d-espaces';
import { AppModule } from '../app.module';
import { FournisseurIA } from '../ai/fournisseur-ia';
import { GenerateurIAFactice } from '../ai/generateur-ia.factice';
import { CATALOGUE_DE_COMMANDES } from './catalogue/catalogue';
import { BUT_RESOLUTION, type SortieDuModele } from './resolution/resoudre';

const REDIRECT_URI = 'http://app.exemple.test/api/auth/callback';
const DASHBOARD_URL = 'http://app.exemple.test/';
const ADRESSE_A = 'a@exemple.test';
const ADRESSE_B = 'b@exemple.test';

/** Une réponse exactement conforme au contrat, sans un champ de plus. */
const [UNE_ACTION, AUCUNE_ACTION] = zCommandResolution.options;
const UNE_RESOLUTION = z.discriminatedUnion('kind', [
  UNE_ACTION.strict(),
  AUCUNE_ACTION.strict(),
]);
const UNE_PAGE = zUnresolvedCommandPage
  .extend({ items: zUnresolvedCommand.strict().array() })
  .strict();

/**
 * Le catalogue de la campagne : celui du build est vide tant qu'aucun
 * endpoint n'est annoté (ADR 0018). Il pointe vers le formulaire de création
 * d'un Événement, dont la route d'écriture existe bel et bien : c'est ce qui
 * prouve que la résolution ne l'appelle pas.
 */
const CATALOGUE: CommandCatalog = {
  actions: [
    {
      id: 'EventController_creer',
      intent: 'Créer un Événement',
      examples: ['ajoute un rendez-vous chez le dentiste jeudi à 10 h'],
      screen: '/calendrier/evenements/nouveau',
      params: {
        title: { required: true, schema: { type: 'string', minLength: 1 } },
        startsAt: {
          required: false,
          schema: { type: 'string', format: 'date-time' },
        },
      },
    },
  ],
};

const DENTISTE: SortieDuModele = {
  actionId: 'EventController_creer',
  params: [
    { name: 'title', value: 'Dentiste' },
    { name: 'startsAt', value: '2026-10-22T08:00:00Z' },
    { name: 'scopeId', value: 'un-espace-choisi-par-le-modele' },
  ],
  plusProche: null,
};

const AUCUNE: SortieDuModele = {
  actionId: null,
  params: [],
  plusProche: 'EventController_creer',
};

/**
 * La barre de commande de bout en bout, sur le double du modèle : aucun appel
 * ne quitte la machine.
 */
describe('Barre de commande', () => {
  let authentik: FauxAuthentik;
  let app: INestApplication;
  let jeu: JeuDEspaces;
  let fournisseur: GenerateurIAFactice;
  let prisma: PrismaService;
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
    })
      .overrideProvider(CATALOGUE_DE_COMMANDES)
      .useValue(CATALOGUE)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    jeu = await poserLeJeuDEspaces(app, authentik, [ADRESSE_A, ADRESSE_B]);
    fournisseur = app.get(FournisseurIA) as GenerateurIAFactice;
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    process.env = environnementInitial;
    await app?.close();
    await authentik?.close();
  });

  function resoudre(compte: CompteDeTest, text: unknown) {
    return request(app.getHttpServer())
      .post('/api/command-bar/resolve')
      .set('Cookie', compte.session)
      .send({ text });
  }

  function journal(compte: CompteDeTest, requete = '') {
    return request(app.getHttpServer())
      .get(`/api/command-bar/unresolved${requete}`)
      .set('Cookie', compte.session);
  }

  /** Tout ce que la base contient, dans les trois Espaces. */
  function compter() {
    return sousPortee(
      {
        espaces: [
          { id: jeu.a.espacePersonnel, kind: 'PERSONAL' },
          { id: jeu.b.espacePersonnel, kind: 'PERSONAL' },
          { id: jeu.espaceFoyer, kind: 'HOUSEHOLD' },
        ],
        typesAcceptes: ['PERSONAL', 'HOUSEHOLD'],
      },
      async () => ({
        evenements: await prisma.event.count(),
        exceptions: await prisma.eventException.count(),
        traces: await prisma.trace.count(),
        nonComprises: await prisma.unresolvedCommand.count(),
      }),
    );
  }

  describe('POST /command-bar/resolve', () => {
    it("rend l'URL du formulaire prérempli d'une phrase connue, et signale le paramètre écarté", async () => {
      fournisseur.programmer(BUT_RESOLUTION, DENTISTE);

      const reponse = await resoudre(
        jeu.a,
        'ajoute un rendez-vous chez le dentiste jeudi à 10 h',
      )
        .expect(200)
        .expect(conformeA(UNE_RESOLUTION));

      expect(reponse.body).toEqual({
        kind: 'action',
        url: '/calendrier/evenements/nouveau?title=Dentiste&startsAt=2026-10-22T08%3A00%3A00Z',
        ignored: ['scopeId'],
      });
    });

    it("n'écrit rien en base lors d'une résolution : ni donnée métier, ni journal", async () => {
      const avant = await compter();
      fournisseur.programmer(BUT_RESOLUTION, DENTISTE);

      await resoudre(jeu.a, 'ajoute dentiste jeudi').expect(200);

      expect(await compter()).toEqual(avant);
    });

    it('dit qu’aucune action ne correspond, et journalise la phrase mot pour mot', async () => {
      const phrase = '  Combien ai-je dépensé en JUILLET ?? ';
      const avant = await compter();
      fournisseur.programmer(BUT_RESOLUTION, AUCUNE);

      const reponse = await resoudre(jeu.a, phrase)
        .expect(200)
        .expect(conformeA(UNE_RESOLUTION));

      expect(reponse.body).toEqual({
        kind: 'none',
        nearestUrl: '/calendrier/evenements/nouveau',
      });
      expect(await compter()).toEqual({
        ...avant,
        nonComprises: avant.nonComprises + 1,
      });

      const page = await journal(jeu.a).expect(200);
      expect((page.body as UnresolvedCommandPage).items[0]).toMatchObject({
        scopeId: jeu.a.espacePersonnel,
        text: phrase,
      });
    });

    it.each([
      ['vide', ''],
      ['blanc', '   '],
      ['trop long', 'a'.repeat(501)],
      ['absent', undefined],
    ])('refuse en 400 un texte %s', async (_cas, text) => {
      await resoudre(jeu.a, text)
        .expect(400)
        .expect(champsEnErreur(['text']));
    });

    it('refuse en 401 une résolution sans session', async () => {
      await request(app.getHttpServer())
        .post('/api/command-bar/resolve')
        .send({ text: 'ajoute dentiste' })
        .expect(401);
    });
  });

  describe('GET /command-bar/unresolved', () => {
    beforeAll(async () => {
      for (const phrase of ['première', 'deuxième', 'troisième']) {
        fournisseur.programmer(BUT_RESOLUTION, AUCUNE);
        await resoudre(jeu.b, phrase).expect(200);
      }
    });

    it('se lit par curseur, des plus récentes aux plus anciennes', async () => {
      const premiere = await journal(jeu.b, '?limit=2')
        .expect(200)
        .expect(conformeA(UNE_PAGE));
      const page = premiere.body as UnresolvedCommandPage;

      expect(page.items.map(({ text }) => text)).toEqual([
        'troisième',
        'deuxième',
      ]);
      expect(page.nextCursor).toBe(page.items[1].id);

      const suivante = await journal(
        jeu.b,
        `?limit=2&cursor=${page.nextCursor}`,
      ).expect(200);
      expect(suivante.body).toMatchObject({
        items: [{ text: 'première' }],
        nextCursor: null,
      });
    });

    it("ne montre jamais les commandes de l'autre Compte", async () => {
      const deA = await journal(jeu.a).expect(200);
      const deB = await journal(jeu.b).expect(200);

      const espaces = (page: UnresolvedCommandPage) =>
        new Set(page.items.map(({ scopeId }) => scopeId));
      expect(espaces(deA.body)).toEqual(new Set([jeu.a.espacePersonnel]));
      expect(espaces(deB.body)).toEqual(new Set([jeu.b.espacePersonnel]));
    });

    it("rend une page vide pour un curseur de l'autre Compte", async () => {
      const deA = (await journal(jeu.a).expect(200))
        .body as UnresolvedCommandPage;

      const reponse = await journal(jeu.b, `?cursor=${deA.items[0].id}`).expect(
        200,
      );

      expect(reponse.body).toEqual({ items: [], nextCursor: null });
    });

    it('refuse en 400 un curseur mal formé', async () => {
      await journal(jeu.a, '?cursor=pas-un-uuid')
        .expect(400)
        .expect(champsEnErreur(['cursor']));
    });

    it('refuse en 401 une lecture sans session', async () => {
      await request(app.getHttpServer())
        .get('/api/command-bar/unresolved')
        .expect(401);
    });
  });
});
