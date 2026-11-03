import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import {
  zPublicPage,
  zPublicProject,
  zPublicProjectSummary,
  type PageContent,
  type PageSlug,
  type Project,
  type PublicPresentation,
  type PublicProjectSummary,
} from '@personal-os/contracts';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

const REDIRECT_URI = 'http://app.exemple.test/api/auth/callback';
const DASHBOARD_URL = 'http://app.exemple.test/';
const ADRESSE_A = 'a@exemple.test';
const ADRESSE_B = 'b@exemple.test';

/** Exactement les contrats publics, sans un champ de plus (SEC-2). */
const UN_PROJET = zPublicProject.strict();
const DES_PROJETS = z.array(zPublicProjectSummary.strict());
const UNE_PAGE = zPublicPage.strict();

const INCONNU = '00000000-0000-4000-8000-000000000000';

const NOTES_PRIVEES = 'NOTE-PRIVEE : le budget réel et les contacts.';
const LIEN_PRIVE = 'https://prive.exemple.test/brouillon';
const DEPENSE_PRIVEE = 'DEPENSE-PRIVEE : licence';

const UN_PDF = Buffer.from('%PDF-1.7\n% un CV public\n%%EOF\n');

/** Lit le corps binaire d'une réponse : sous Node, elle est un flux. */
function binaire(
  reponse: request.Response,
  rappel: (erreur: Error | null, corps: Buffer) => void,
): void {
  const flux = reponse as unknown as NodeJS.ReadableStream;
  const morceaux: Buffer[] = [];
  flux.on('data', (morceau: Buffer) => morceaux.push(morceau));
  flux.on('end', () => rappel(null, Buffer.concat(morceaux)));
}

/** Toutes les clés d'un corps JSON, à toute profondeur. */
function clesDe(valeur: unknown): string[] {
  if (Array.isArray(valeur)) return valeur.flatMap(clesDe);
  if (!valeur || typeof valeur !== 'object') return [];
  return Object.entries(valeur).flatMap(([cle, sous]) => [
    cle,
    ...clesDe(sous),
  ]);
}

/**
 * Le chemin public du portfolio : sans session, il ne sert que le publié,
 * dans la langue demandée et jamais une autre, sans rien des notes, liens ni
 * dépenses d'un Projet, et sans aucun champ d'Espace (ADR 0019, SEC-2).
 */
describe('Portfolio public', () => {
  let authentik: FauxAuthentik;
  let app: NestExpressApplication;
  let jeu: JeuDEspaces;
  let stockage: string;

  beforeAll(async () => {
    authentik = await demarrerFauxAuthentik();
    stockage = await mkdtemp(join(tmpdir(), 'personal-os-public-'));

    process.env['OIDC_ISSUER'] = authentik.issuer;
    process.env['OIDC_CLIENT_ID'] = 'personal-os';
    process.env['OIDC_CLIENT_SECRET'] = 'secret-de-test';
    process.env['OIDC_REDIRECT_URI'] = REDIRECT_URI;
    process.env['DASHBOARD_URL'] = DASHBOARD_URL;
    process.env['AUTH_ALLOWED_EMAILS'] = `${ADRESSE_A},${ADRESSE_B}`;
    process.env['STORAGE_PROVIDER'] = 'disk';
    process.env['STORAGE_DISK_DIR'] = stockage;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.setGlobalPrefix('api');
    accepterLesCorpsJson(app);
    await app.init();

    jeu = await poserLeJeuDEspaces(app, authentik, [ADRESSE_A, ADRESSE_B]);
  });

  afterAll(async () => {
    await app?.close();
    await authentik?.close();
    await rm(stockage, { recursive: true, force: true });
  });

  describe('GET /public/:lang/projects', () => {
    it('sert sans session les projets publiés des deux Comptes, conformes au contrat public', async () => {
      const deA = await projetPublie(jeu.a, 'Public : projet de A', ['FR']);
      const deB = await projetPublie(jeu.b, 'Public : projet de B', ['FR']);

      const reponse = await request(app.getHttpServer())
        .get('/api/public/FR/projects')
        .expect(200)
        .expect(conformeA(DES_PROJETS));

      const ids = (reponse.body as PublicProjectSummary[]).map(({ id }) => id);
      expect(ids).toEqual(expect.arrayContaining([deA.id, deB.id]));
      expect(
        (reponse.body as PublicProjectSummary[]).find(
          ({ id }) => id === deA.id,
        ),
      ).toMatchObject({
        lang: 'FR',
        title: 'Public : projet de A (FR)',
        summary: 'Une accroche publique.',
      });
    });

    it('ne sert rien de non publié, même à une session ouverte', async () => {
      const brouillon = await creerUnProjet(jeu.a, 'Public : brouillon');
      await rediger(jeu.a, brouillon.id, 'FR');
      const pret = await creerUnProjet(jeu.a, 'Public : prêt');
      await rediger(jeu.a, pret.id, 'FR');
      await transition(jeu.a, pret.id, 'FR', 'ready');
      const retire = await projetPublie(jeu.a, 'Public : retiré', ['FR']);
      await transition(jeu.a, retire.id, 'FR', 'unpublish');
      const modifie = await projetPublie(jeu.a, 'Public : modifié', ['FR']);
      await rediger(jeu.a, modifie.id, 'FR', { summary: 'Retouchée.' });

      for (const session of [undefined, jeu.a.session]) {
        const lecture = request(app.getHttpServer()).get(
          '/api/public/FR/projects',
        );
        const reponse = await (
          session ? lecture.set('Cookie', session) : lecture
        ).expect(200);

        const ids = (reponse.body as PublicProjectSummary[]).map(
          ({ id }) => id,
        );
        for (const cache of [brouillon, pret, retire, modifie]) {
          expect(ids).not.toContain(cache.id);
        }
      }
    });

    it("n'inclut pas en anglais un projet qui n'a que sa présentation française", async () => {
      const bilingue = await projetPublie(jeu.a, 'Public : bilingue', [
        'FR',
        'EN',
      ]);
      const francais = await projetPublie(jeu.a, 'Public : français', ['FR']);
      // Une présentation anglaise rédigée mais non publiée ne compte pas.
      await rediger(jeu.a, francais.id, 'EN');

      const reponse = await request(app.getHttpServer())
        .get('/api/public/EN/projects')
        .expect(200)
        .expect(conformeA(DES_PROJETS));

      const projets = reponse.body as PublicProjectSummary[];
      expect(projets.map(({ id }) => id)).toContain(bilingue.id);
      expect(projets.map(({ id }) => id)).not.toContain(francais.id);
      expect(projets.every(({ lang }) => lang === 'EN')).toBe(true);
      expect(projets.find(({ id }) => id === bilingue.id)?.title).toBe(
        'Public : bilingue (EN)',
      );
    });

    it('refuse une langue inconnue par un 400 qui pointe `lang`', async () => {
      await request(app.getHttpServer())
        .get('/api/public/fr/projects')
        .expect(400)
        .expect(champsEnErreur(['lang']));
    });
  });

  describe('GET /public/:lang/projects/:id', () => {
    it('sert la présentation publiée, sans note, lien, dépense ni Espace du Projet', async () => {
      const projet = await projetPublie(jeu.a, 'Public : détail', ['FR']);

      const reponse = await request(app.getHttpServer())
        .get(`/api/public/FR/projects/${projet.id}`)
        .expect(200)
        .expect(conformeA(UN_PROJET));

      expect(reponse.body).toMatchObject({
        id: projet.id,
        lang: 'FR',
        title: 'Public : détail (FR)',
        body: '## Le projet\n\nLe texte public.',
      });
      expect(reponse.text).not.toContain('NOTE-PRIVEE');
      expect(reponse.text).not.toContain(LIEN_PRIVE);
      expect(reponse.text).not.toContain('DEPENSE-PRIVEE');
      expect(clesDe(reponse.body)).not.toContain('scopeId');
    });

    it("rend un 404, sans repli sur le français, pour un projet qui n'est pas publié en anglais", async () => {
      const projet = await projetPublie(jeu.a, 'Public : sans anglais', ['FR']);
      await rediger(jeu.a, projet.id, 'EN');
      await transition(jeu.a, projet.id, 'EN', 'ready');

      await request(app.getHttpServer())
        .get(`/api/public/EN/projects/${projet.id}`)
        .expect(404)
        .expect(codeDErreur('portfolio.public_project_not_found'));
    });

    it("rend le même 404 pour un projet qui n'existe pas", async () => {
      await request(app.getHttpServer())
        .get(`/api/public/FR/projects/${INCONNU}`)
        .expect(404)
        .expect(codeDErreur('portfolio.public_project_not_found'));
    });
  });

  describe('GET /public/:lang/pages/:slug', () => {
    it('sert la page publiée de cette langue, conforme au contrat public', async () => {
      await pagePubliee('about', 'FR', 'À propos, publié');

      const reponse = await request(app.getHttpServer())
        .get('/api/public/FR/pages/about')
        .expect(200)
        .expect(conformeA(UNE_PAGE));

      expect(reponse.body).toEqual({
        slug: 'about',
        lang: 'FR',
        title: 'À propos, publié',
        body: 'Le texte publié.',
      });
      expect(clesDe(reponse.body)).not.toContain('scopeId');
    });

    it("rend un 404 pour une page rédigée mais pas publiée, sans repli sur l'autre langue", async () => {
      await pagePubliee('skills', 'FR', 'Compétences, publiées');
      await redigerLaPage('skills', 'EN', 'Skills, draft');

      await request(app.getHttpServer())
        .get('/api/public/EN/pages/skills')
        .expect(404)
        .expect(codeDErreur('portfolio.public_page_not_found'));
    });

    it('refuse une page inconnue par un 400 qui pointe `slug`', async () => {
      await request(app.getHttpServer())
        .get('/api/public/FR/pages/contact')
        .expect(400)
        .expect(champsEnErreur(['slug']));
    });
  });

  describe('GET /public/cv/:lang', () => {
    it('sert sans session le PDF téléversé pour cette langue', async () => {
      await request(app.getHttpServer())
        .put('/api/cv/FR')
        .set('Cookie', jeu.a.session)
        .attach('file', UN_PDF, {
          filename: 'cv.pdf',
          contentType: 'application/pdf',
        })
        .expect(200);

      const reponse = await request(app.getHttpServer())
        .get('/api/public/cv/FR')
        .buffer(true)
        .parse(binaire)
        .expect(200)
        .expect('Content-Type', 'application/pdf');

      expect(Buffer.compare(reponse.body as Buffer, UN_PDF)).toBe(0);

      // Le portfolio demande par un HEAD si le CV existe, sans le télécharger.
      await request(app.getHttpServer())
        .head('/api/public/cv/FR')
        .expect(200)
        .expect('Content-Type', 'application/pdf');
    });

    it("rend un 404 pour une langue sans CV, sans repli sur l'autre", async () => {
      await request(app.getHttpServer())
        .get('/api/public/cv/EN')
        .expect(404)
        .expect(codeDErreur('portfolio.cv_not_found'));
      await request(app.getHttpServer()).head('/api/public/cv/EN').expect(404);
    });
  });

  it('laisse les routes privées fermées sans session', async () => {
    await request(app.getHttpServer())
      .get('/api/page-contents')
      .expect(401)
      .expect(codeDErreur('auth.required'));
  });

  /**
   * Un Projet aux notes, liens et dépenses privés, dont la Présentation
   * publique est publiée dans chacune de ces langues.
   */
  async function projetPublie(
    compte: CompteDeTest,
    title: string,
    langues: ('FR' | 'EN')[],
  ): Promise<Project> {
    const projet = await creerUnProjet(compte, title);
    await request(app.getHttpServer())
      .post(`/api/projects/${projet.id}/expenses`)
      .set('Cookie', compte.session)
      .send({
        label: DEPENSE_PRIVEE,
        amount: { cents: 1200, currency: 'EUR' },
        spentOn: '2026-10-01',
      })
      .expect(201);

    for (const lang of langues) {
      await rediger(compte, projet.id, lang, { title: `${title} (${lang})` });
      await transition(compte, projet.id, lang, 'ready');
      await transition(compte, projet.id, lang, 'publish');
    }
    return projet;
  }

  async function creerUnProjet(
    compte: CompteDeTest,
    title: string,
  ): Promise<Project> {
    const reponse = await request(app.getHttpServer())
      .post('/api/projects')
      .set('Cookie', compte.session)
      .send({
        title,
        notes: NOTES_PRIVEES,
        links: [{ label: 'Brouillon', url: LIEN_PRIVE }],
      })
      .expect(201);

    return reponse.body;
  }

  async function rediger(
    compte: CompteDeTest,
    projectId: string,
    lang: 'FR' | 'EN',
    texte: Record<string, unknown> = {},
  ): Promise<PublicPresentation> {
    const reponse = await request(app.getHttpServer())
      .put(`/api/projects/${projectId}/presentations/${lang}`)
      .set('Cookie', compte.session)
      .send({
        title: 'Un titre',
        summary: 'Une accroche publique.',
        body: '## Le projet\n\nLe texte public.',
        ...texte,
      })
      .expect(200);

    return reponse.body;
  }

  async function transition(
    compte: CompteDeTest,
    projectId: string,
    lang: 'FR' | 'EN',
    verbe: 'ready' | 'publish' | 'unpublish',
  ): Promise<void> {
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/presentations/${lang}/${verbe}`)
      .set('Cookie', compte.session)
      .expect(200);
  }

  /**
   * Les Pages de contenu sont globales, et d'autres fichiers les écrivent dans
   * la même base : on part de l'état que la rédaction rend, quel qu'il soit.
   */
  async function redigerLaPage(
    slug: PageSlug,
    lang: 'FR' | 'EN',
    title: string,
  ): Promise<PageContent> {
    const reponse = await request(app.getHttpServer())
      .put(`/api/page-contents/${slug}/${lang}`)
      .set('Cookie', jeu.a.session)
      .send({ title, body: 'Le texte publié.' })
      .expect(200);
    const page = reponse.body as PageContent;

    // Un texte identique ne change rien : une page déjà publiée le reste.
    if (page.publicationState === 'PUBLISHED') {
      await request(app.getHttpServer())
        .post(`/api/page-contents/${slug}/${lang}/unpublish`)
        .set('Cookie', jeu.a.session)
        .expect(200);
      return { ...page, publicationState: 'UNPUBLISHED' };
    }
    return page;
  }

  async function pagePubliee(
    slug: PageSlug,
    lang: 'FR' | 'EN',
    title: string,
  ): Promise<void> {
    const page = await redigerLaPage(slug, lang, title);
    const verbes =
      page.publicationState === 'READY' ? ['publish'] : ['ready', 'publish'];
    for (const verbe of verbes) {
      await request(app.getHttpServer())
        .post(`/api/page-contents/${slug}/${lang}/${verbe}`)
        .set('Cookie', jeu.a.session)
        .expect(200);
    }
  }
});
