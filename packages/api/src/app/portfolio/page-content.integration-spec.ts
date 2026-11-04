import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import {
  zPageContent,
  type Lang,
  type PageContent,
  type PageSlug,
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
import { accepterLesCorpsJson } from '../../corps';
import { AppModule } from '../app.module';
import { PageContentRepository } from './page-content.repository';

const REDIRECT_URI = 'http://app.exemple.test/api/auth/callback';
const DASHBOARD_URL = 'http://app.exemple.test/';
const ADRESSE_A = 'a@exemple.test';
const ADRESSE_B = 'b@exemple.test';

/** Une Page de contenu exactement conforme au contrat, sans un champ de plus. */
const UNE_PAGE = zPageContent.strict();
const DES_PAGES = z.array(UNE_PAGE);

const UN_TEXTE = {
  title: 'Qui je suis',
  body: '## Parcours\n\nDu papier au code, *à la main*.',
};

/**
 * Les Pages de contenu du portfolio : trois pages, deux langues, chacune avec
 * son État de publication. Elles sont globales, hors Espace : les deux Comptes
 * rédigent le même portfolio, et il n'y a pas de cas cross-Espace.
 */
describe('Pages de contenu', () => {
  let authentik: FauxAuthentik;
  let app: NestExpressApplication;
  let jeu: JeuDEspaces;

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

    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.setGlobalPrefix('api');
    accepterLesCorpsJson(app);
    await app.init();

    jeu = await poserLeJeuDEspaces(app, authentik, [ADRESSE_A, ADRESSE_B]);
  });

  // Six textes au plus, partagés par tout le fichier : chaque cas part d'un
  // portfolio vide.
  beforeEach(async () => {
    await app.get(PrismaService).pageContent.deleteMany({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await app?.close();
    await authentik?.close();
  });

  describe('PUT /page-contents/:slug/:lang', () => {
    it('crée la page, non publiée, conforme au contrat', async () => {
      const reponse = await request(app.getHttpServer())
        .put('/api/page-contents/about/FR')
        .set('Cookie', jeu.a.session)
        .send({ ...UN_TEXTE, title: '  Qui je suis ' })
        .expect(200)
        .expect(conformeA(UNE_PAGE));

      expect(reponse.body).toMatchObject({
        ...UN_TEXTE,
        slug: 'about',
        lang: 'FR',
        publicationState: 'UNPUBLISHED',
      });
    });

    it('accepte une page sans texte encore', async () => {
      const reponse = await request(app.getHttpServer())
        .put('/api/page-contents/skills/EN')
        .set('Cookie', jeu.a.session)
        .send({ title: 'Skills' })
        .expect(200)
        .expect(conformeA(UNE_PAGE));

      expect(reponse.body).toMatchObject({ title: 'Skills', body: '' });
    });

    it('ne remplace que le texte : une page non publiée ou prête le reste', async () => {
      await rediger(jeu.a, 'about', 'FR');

      expect(
        await rediger(jeu.a, 'about', 'FR', { title: 'Deuxième version' }),
      ).toMatchObject({
        title: 'Deuxième version',
        body: UN_TEXTE.body,
        publicationState: 'UNPUBLISHED',
      });

      await transition(jeu.a, 'about', 'FR', 'ready');
      expect(
        await rediger(jeu.a, 'about', 'FR', { body: 'Un autre texte.' }),
      ).toMatchObject({ publicationState: 'READY' });
    });

    it("n'accepte pas d'État de publication saisi : la rédaction ne publie jamais", async () => {
      const page = await rediger(jeu.a, 'about', 'FR', {
        publicationState: 'PUBLISHED',
      });

      expect(page.publicationState).toBe('UNPUBLISHED');
    });

    it('retire du portfolio une page publiée qu’on modifie, jusqu’à sa republication', async () => {
      await rediger(jeu.a, 'experience', 'FR');
      await transition(jeu.a, 'experience', 'FR', 'ready');
      await transition(jeu.a, 'experience', 'FR', 'publish');

      const modifiee = await rediger(jeu.a, 'experience', 'FR', {
        body: 'Un texte relu, qui attend son « Publier ».',
      });
      expect(modifiee).toMatchObject({
        body: 'Un texte relu, qui attend son « Publier ».',
        publicationState: 'READY',
      });

      const republiee = await transition(jeu.a, 'experience', 'FR', 'publish');
      expect(republiee.publicationState).toBe('PUBLISHED');
    });

    it('retire du portfolio le texte publié entre-temps par une première rédaction concurrente', async () => {
      await rediger(jeu.a, 'about', 'FR');
      await transition(jeu.a, 'about', 'FR', 'ready');
      await transition(jeu.a, 'about', 'FR', 'publish');
      // Cette rédaction a lu la langue vide, avant que l'autre la crée et la
      // publie : elle écrit après coup.
      jest
        .spyOn(app.get(PageContentRepository), 'lire')
        .mockResolvedValueOnce(null);

      const ecrite = await rediger(jeu.b, 'about', 'FR', {
        body: 'Un texte écrit en même temps.',
      });

      expect(ecrite).toMatchObject({
        body: 'Un texte écrit en même temps.',
        publicationState: 'READY',
      });
    });

    it('laisse en ligne une page publiée renvoyée à l’identique', async () => {
      await rediger(jeu.a, 'about', 'FR');
      await transition(jeu.a, 'about', 'FR', 'ready');
      const publiee = await transition(jeu.a, 'about', 'FR', 'publish');

      expect(await rediger(jeu.a, 'about', 'FR')).toEqual(publiee);
    });

    it('tient un texte par page et par langue, chacun avec son état', async () => {
      await rediger(jeu.a, 'about', 'FR');
      await transition(jeu.a, 'about', 'FR', 'ready');
      await rediger(jeu.a, 'about', 'EN', { title: 'Who I am' });
      await rediger(jeu.a, 'skills', 'FR', { title: 'Compétences' });

      expect(
        (await lister(jeu.a)).map(({ slug, lang, publicationState }) => ({
          slug,
          lang,
          publicationState,
        })),
      ).toEqual([
        { slug: 'about', lang: 'FR', publicationState: 'READY' },
        { slug: 'about', lang: 'EN', publicationState: 'UNPUBLISHED' },
        { slug: 'skills', lang: 'FR', publicationState: 'UNPUBLISHED' },
      ]);
    });

    it("rédige le même portfolio depuis l'un ou l'autre Compte", async () => {
      await rediger(jeu.a, 'about', 'FR');

      const deB = await rediger(jeu.b, 'about', 'FR', {
        title: 'Relu par l’autre Compte',
      });

      expect(deB.title).toBe('Relu par l’autre Compte');
      expect(await lister(jeu.a)).toEqual([deB]);
    });

    it('refuse en 400 un titre vide, une page ou une langue inconnue', async () => {
      await request(app.getHttpServer())
        .put('/api/page-contents/about/FR')
        .set('Cookie', jeu.a.session)
        .send({ title: ' ', body: 42 })
        .expect(400)
        .expect(champsEnErreur(['title', 'body']));

      await request(app.getHttpServer())
        .put('/api/page-contents/contact/FR')
        .set('Cookie', jeu.a.session)
        .send(UN_TEXTE)
        .expect(400)
        .expect(champsEnErreur(['slug']));

      await request(app.getHttpServer())
        .put('/api/page-contents/about/DE')
        .set('Cookie', jeu.a.session)
        .send(UN_TEXTE)
        .expect(400)
        .expect(champsEnErreur(['lang']));

      expect(await lister(jeu.a)).toEqual([]);
    });

    it("n'accepte rien sans session", async () => {
      await request(app.getHttpServer())
        .put('/api/page-contents/about/FR')
        .send(UN_TEXTE)
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('GET /page-contents', () => {
    it('rend les pages rédigées, conformes au contrat, dans l’ordre du portfolio', async () => {
      await rediger(jeu.a, 'skills', 'EN', { title: 'Skills' });
      await rediger(jeu.a, 'experience', 'FR', { title: 'Expériences' });
      await rediger(jeu.a, 'about', 'EN', { title: 'About' });
      await rediger(jeu.a, 'about', 'FR');

      const reponse = await request(app.getHttpServer())
        .get('/api/page-contents')
        .set('Cookie', jeu.b.session)
        .expect(200)
        .expect(conformeA(DES_PAGES));

      expect(
        reponse.body.map(({ slug, lang }: PageContent) => `${slug}/${lang}`),
      ).toEqual(['about/FR', 'about/EN', 'experience/FR', 'skills/EN']);
    });

    it('rend une liste vide tant que rien n’est rédigé', async () => {
      expect(await lister(jeu.a)).toEqual([]);
    });

    it("n'expose rien sans session", async () => {
      await request(app.getHttpServer())
        .get('/api/page-contents')
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('POST /page-contents/:slug/:lang/ready', () => {
    it('marque prête une page non publiée', async () => {
      await rediger(jeu.a, 'about', 'FR');

      const reponse = await request(app.getHttpServer())
        .post('/api/page-contents/about/FR/ready')
        .set('Cookie', jeu.a.session)
        .expect(200)
        .expect(conformeA(UNE_PAGE));

      expect(reponse.body.publicationState).toBe('READY');
    });

    it('refuse en 422 une page déjà prête ou publiée', async () => {
      await rediger(jeu.a, 'about', 'FR');
      await transition(jeu.a, 'about', 'FR', 'ready');

      await request(app.getHttpServer())
        .post('/api/page-contents/about/FR/ready')
        .set('Cookie', jeu.a.session)
        .expect(422)
        .expect(codeDErreur('portfolio.not_unpublished'));

      await transition(jeu.a, 'about', 'FR', 'publish');
      await request(app.getHttpServer())
        .post('/api/page-contents/about/FR/ready')
        .set('Cookie', jeu.a.session)
        .expect(422)
        .expect(codeDErreur('portfolio.not_unpublished'));
    });

    it("rend 404 sur une langue que la page n'a pas encore", async () => {
      await rediger(jeu.a, 'about', 'FR');

      await request(app.getHttpServer())
        .post('/api/page-contents/about/EN/ready')
        .set('Cookie', jeu.a.session)
        .expect(404)
        .expect(codeDErreur('portfolio.page_content_not_found'));
    });

    it('refuse en 400 une page ou une langue inconnue', async () => {
      await request(app.getHttpServer())
        .post('/api/page-contents/cv/FR/ready')
        .set('Cookie', jeu.a.session)
        .expect(400)
        .expect(champsEnErreur(['slug']));

      await request(app.getHttpServer())
        .post('/api/page-contents/about/fr-FR/ready')
        .set('Cookie', jeu.a.session)
        .expect(400)
        .expect(champsEnErreur(['lang']));
    });

    it("n'accepte rien sans session", async () => {
      await request(app.getHttpServer())
        .post('/api/page-contents/about/FR/ready')
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('POST /page-contents/:slug/:lang/publish', () => {
    it('publie une page prête, dans sa seule langue', async () => {
      await rediger(jeu.a, 'skills', 'FR');
      await rediger(jeu.a, 'skills', 'EN');
      await transition(jeu.a, 'skills', 'FR', 'ready');
      await transition(jeu.a, 'skills', 'EN', 'ready');

      const reponse = await request(app.getHttpServer())
        .post('/api/page-contents/skills/EN/publish')
        .set('Cookie', jeu.a.session)
        .expect(200)
        .expect(conformeA(UNE_PAGE));

      expect(reponse.body).toMatchObject({
        lang: 'EN',
        publicationState: 'PUBLISHED',
      });
      expect(
        (await lister(jeu.a)).map(({ lang, publicationState }) => ({
          lang,
          publicationState,
        })),
      ).toEqual([
        { lang: 'FR', publicationState: 'READY' },
        { lang: 'EN', publicationState: 'PUBLISHED' },
      ]);
    });

    it('refuse en 422 une page qui n’est pas prête à publier', async () => {
      await rediger(jeu.a, 'about', 'FR');

      await request(app.getHttpServer())
        .post('/api/page-contents/about/FR/publish')
        .set('Cookie', jeu.a.session)
        .expect(422)
        .expect(codeDErreur('portfolio.not_ready'));

      expect((await lister(jeu.a))[0]?.publicationState).toBe('UNPUBLISHED');
    });

    it('refuse en 422 une page déjà publiée, sans la toucher', async () => {
      await rediger(jeu.a, 'about', 'FR');
      await transition(jeu.a, 'about', 'FR', 'ready');
      const publiee = await transition(jeu.a, 'about', 'FR', 'publish');

      await request(app.getHttpServer())
        .post('/api/page-contents/about/FR/publish')
        .set('Cookie', jeu.a.session)
        .expect(422)
        .expect(codeDErreur('portfolio.not_ready'));

      expect(await lister(jeu.a)).toEqual([publiee]);
    });

    it("rend 404 sur une page qui n'est pas rédigée", async () => {
      await request(app.getHttpServer())
        .post('/api/page-contents/experience/FR/publish')
        .set('Cookie', jeu.a.session)
        .expect(404)
        .expect(codeDErreur('portfolio.page_content_not_found'));
    });

    it('refuse en 400 une langue inconnue', async () => {
      await request(app.getHttpServer())
        .post('/api/page-contents/about/de/publish')
        .set('Cookie', jeu.a.session)
        .expect(400)
        .expect(champsEnErreur(['lang']));
    });

    it("n'accepte rien sans session", async () => {
      await request(app.getHttpServer())
        .post('/api/page-contents/about/FR/publish')
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('POST /page-contents/:slug/:lang/unpublish', () => {
    it('retire du portfolio une page publiée', async () => {
      await rediger(jeu.a, 'about', 'FR');
      await transition(jeu.a, 'about', 'FR', 'ready');
      await transition(jeu.a, 'about', 'FR', 'publish');

      const reponse = await request(app.getHttpServer())
        .post('/api/page-contents/about/FR/unpublish')
        .set('Cookie', jeu.a.session)
        .expect(200)
        .expect(conformeA(UNE_PAGE));

      expect(reponse.body.publicationState).toBe('UNPUBLISHED');
    });

    it('refuse en 422 une page déjà non publiée', async () => {
      await rediger(jeu.a, 'about', 'FR');

      await request(app.getHttpServer())
        .post('/api/page-contents/about/FR/unpublish')
        .set('Cookie', jeu.a.session)
        .expect(422)
        .expect(codeDErreur('portfolio.already_unpublished'));
    });

    it("rend 404 sur une page qui n'est pas rédigée", async () => {
      await request(app.getHttpServer())
        .post('/api/page-contents/skills/EN/unpublish')
        .set('Cookie', jeu.a.session)
        .expect(404)
        .expect(codeDErreur('portfolio.page_content_not_found'));
    });

    it('refuse en 400 une page inconnue', async () => {
      await request(app.getHttpServer())
        .post('/api/page-contents/ABOUT/FR/unpublish')
        .set('Cookie', jeu.a.session)
        .expect(400)
        .expect(champsEnErreur(['slug']));
    });

    it("n'accepte rien sans session", async () => {
      await request(app.getHttpServer())
        .post('/api/page-contents/about/FR/unpublish')
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  async function rediger(
    compte: CompteDeTest,
    slug: PageSlug,
    lang: Lang,
    texte: Record<string, unknown> = {},
  ): Promise<PageContent> {
    const reponse = await request(app.getHttpServer())
      .put(`/api/page-contents/${slug}/${lang}`)
      .set('Cookie', compte.session)
      .send({ ...UN_TEXTE, ...texte })
      .expect(200);

    return reponse.body;
  }

  async function transition(
    compte: CompteDeTest,
    slug: PageSlug,
    lang: Lang,
    verbe: 'ready' | 'publish' | 'unpublish',
  ): Promise<PageContent> {
    const reponse = await request(app.getHttpServer())
      .post(`/api/page-contents/${slug}/${lang}/${verbe}`)
      .set('Cookie', compte.session)
      .expect(200);

    return reponse.body;
  }

  async function lister(compte: CompteDeTest): Promise<PageContent[]> {
    const reponse = await request(app.getHttpServer())
      .get('/api/page-contents')
      .set('Cookie', compte.session)
      .expect(200);

    return reponse.body;
  }
});
