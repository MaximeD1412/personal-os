import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import {
  zPublicPresentation,
  type Project,
  type PublicPresentation,
} from '@personal-os/contracts';
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

/** Une Présentation publique exactement conforme au contrat, sans un champ de plus. */
const UNE_PRESENTATION = zPublicPresentation.strict();
const DES_PRESENTATIONS = z.array(UNE_PRESENTATION);

const INCONNU = '00000000-0000-4000-8000-000000000000';

const UN_TEXTE = {
  title: 'Atelier de reliure',
  summary: 'Des carnets cousus main, du papier au fil.',
  body: '## Le projet\n\nUne reliure copte, *à la main*.',
};

/**
 * La Présentation publique d'un Projet, une par langue, et son État de
 * publication. Elle est dans l'Espace personnel de son Projet : celle de
 * l'autre Compte rend un 404, comme un Projet qui n'existe pas (ADR 0030).
 */
describe('Présentations publiques', () => {
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

  afterAll(async () => {
    await app?.close();
    await authentik?.close();
  });

  describe('PUT /projects/:id/presentations/:lang', () => {
    it('crée la présentation, non publiée, conforme au contrat', async () => {
      const projet = await creerUnProjet(jeu.a, 'Rédaction : création');

      const reponse = await request(app.getHttpServer())
        .put(`/api/projects/${projet.id}/presentations/FR`)
        .set('Cookie', jeu.a.session)
        .send({ ...UN_TEXTE, title: '  Atelier de reliure ' })
        .expect(200)
        .expect(conformeA(UNE_PRESENTATION));

      expect(reponse.body).toMatchObject({
        ...UN_TEXTE,
        projectId: projet.id,
        lang: 'FR',
        publicationState: 'UNPUBLISHED',
        publishedAt: null,
      });
    });

    it('ne remplace que le texte : une présentation non publiée ou prête le reste', async () => {
      const projet = await creerUnProjet(jeu.a, 'Rédaction : modification');
      await rediger(jeu.a, projet.id, 'FR');

      const modifiee = await rediger(jeu.a, projet.id, 'FR', {
        title: 'Reliure, deuxième version',
      });
      expect(modifiee).toMatchObject({
        title: 'Reliure, deuxième version',
        summary: UN_TEXTE.summary,
        publicationState: 'UNPUBLISHED',
      });

      await transition(jeu.a, projet.id, 'FR', 'ready');
      expect(
        await rediger(jeu.a, projet.id, 'FR', {
          summary: 'Une autre accroche.',
        }),
      ).toMatchObject({ publicationState: 'READY', publishedAt: null });
    });

    it("n'accepte pas d'État de publication saisi : la rédaction ne publie jamais", async () => {
      const projet = await creerUnProjet(jeu.a, 'Rédaction : état saisi');

      const presentation = await rediger(jeu.a, projet.id, 'FR', {
        publicationState: 'PUBLISHED',
        publishedAt: '2026-10-01T08:00:00.000Z',
      });

      expect(presentation).toMatchObject({
        publicationState: 'UNPUBLISHED',
        publishedAt: null,
      });
    });

    it('retire du portfolio une présentation publiée qu’on modifie, jusqu’à sa republication', async () => {
      const projet = await creerUnProjet(jeu.a, 'Rédaction : texte publié');
      await rediger(jeu.a, projet.id, 'FR');
      await transition(jeu.a, projet.id, 'FR', 'ready');
      await transition(jeu.a, projet.id, 'FR', 'publish');

      const modifiee = await rediger(jeu.a, projet.id, 'FR', {
        body: 'Un texte relu, qui attend son « Publier ».',
      });
      expect(modifiee).toMatchObject({
        body: 'Un texte relu, qui attend son « Publier ».',
        publicationState: 'READY',
        publishedAt: null,
      });

      const republiee = await transition(jeu.a, projet.id, 'FR', 'publish');
      expect(republiee.publicationState).toBe('PUBLISHED');
    });

    it('laisse en ligne une présentation publiée renvoyée à l’identique', async () => {
      const projet = await creerUnProjet(jeu.a, 'Rédaction : sans changement');
      await rediger(jeu.a, projet.id, 'FR');
      await transition(jeu.a, projet.id, 'FR', 'ready');
      const publiee = await transition(jeu.a, projet.id, 'FR', 'publish');

      expect(await rediger(jeu.a, projet.id, 'FR')).toEqual(publiee);
    });

    it('tient une présentation par langue, chacune avec son état', async () => {
      const projet = await creerUnProjet(jeu.a, 'Rédaction : deux langues');
      await rediger(jeu.a, projet.id, 'FR');
      await transition(jeu.a, projet.id, 'FR', 'ready');

      const anglaise = await rediger(jeu.a, projet.id, 'EN', {
        title: 'Bookbinding workshop',
        summary: 'Hand-sewn notebooks.',
      });

      expect(anglaise).toMatchObject({
        lang: 'EN',
        title: 'Bookbinding workshop',
        publicationState: 'UNPUBLISHED',
      });
      expect(
        (await lister(jeu.a, projet.id)).map(({ lang, publicationState }) => ({
          lang,
          publicationState,
        })),
      ).toEqual([
        { lang: 'FR', publicationState: 'READY' },
        { lang: 'EN', publicationState: 'UNPUBLISHED' },
      ]);
    });

    it('refuse en 400 un titre et une accroche vides, et une langue inconnue', async () => {
      const projet = await creerUnProjet(jeu.a, 'Rédaction : refus');

      await request(app.getHttpServer())
        .put(`/api/projects/${projet.id}/presentations/FR`)
        .set('Cookie', jeu.a.session)
        .send({ title: ' ', summary: '' })
        .expect(400)
        .expect(champsEnErreur(['title', 'summary']));

      await request(app.getHttpServer())
        .put(`/api/projects/${projet.id}/presentations/DE`)
        .set('Cookie', jeu.a.session)
        .send(UN_TEXTE)
        .expect(400)
        .expect(champsEnErreur(['lang']));
    });

    it("rend 404 sur le Projet de l'autre Compte, et n'y écrit rien", async () => {
      const deB = await creerUnProjet(jeu.b, 'Rédaction : Projet de B');
      await rediger(jeu.b, deB.id, 'FR');

      for (const id of [deB.id, INCONNU]) {
        await request(app.getHttpServer())
          .put(`/api/projects/${id}/presentations/FR`)
          .set('Cookie', jeu.a.session)
          .send({ ...UN_TEXTE, title: 'Détourné' })
          .expect(404)
          .expect(codeDErreur('project.not_found'));
      }

      expect((await lister(jeu.b, deB.id))[0]?.title).toBe(UN_TEXTE.title);
    });

    it("n'accepte rien sans session", async () => {
      await request(app.getHttpServer())
        .put(`/api/projects/${INCONNU}/presentations/FR`)
        .send(UN_TEXTE)
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('GET /projects/:id/presentations', () => {
    it('rend les présentations du Projet, conformes au contrat, sans ses notes privées', async () => {
      const projet = await creerUnProjet(jeu.a, 'Lecture : un Projet');
      await rediger(jeu.a, projet.id, 'EN');

      const reponse = await request(app.getHttpServer())
        .get(`/api/projects/${projet.id}/presentations`)
        .set('Cookie', jeu.a.session)
        .expect(200)
        .expect(conformeA(DES_PRESENTATIONS));

      expect(reponse.body).toHaveLength(1);
      expect(JSON.stringify(reponse.body)).not.toContain('notes privées');
    });

    it('rend une liste vide pour un Projet sans présentation', async () => {
      const projet = await creerUnProjet(jeu.a, 'Lecture : sans présentation');

      expect(await lister(jeu.a, projet.id)).toEqual([]);
    });

    it("rend 404 sur le Projet de l'autre Compte, comme sur un Projet inconnu", async () => {
      const deB = await creerUnProjet(jeu.b, 'Lecture : Projet de B');
      await rediger(jeu.b, deB.id, 'FR');

      for (const id of [deB.id, INCONNU]) {
        await request(app.getHttpServer())
          .get(`/api/projects/${id}/presentations`)
          .set('Cookie', jeu.a.session)
          .expect(404)
          .expect(codeDErreur('project.not_found'));
      }
    });

    it("n'expose rien sans session", async () => {
      await request(app.getHttpServer())
        .get(`/api/projects/${INCONNU}/presentations`)
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('POST /projects/:id/presentations/:lang/ready', () => {
    it('marque prête une présentation non publiée', async () => {
      const projet = await creerUnProjet(jeu.a, 'Prête : nominal');
      await rediger(jeu.a, projet.id, 'FR');

      const reponse = await request(app.getHttpServer())
        .post(`/api/projects/${projet.id}/presentations/FR/ready`)
        .set('Cookie', jeu.a.session)
        .expect(200)
        .expect(conformeA(UNE_PRESENTATION));

      expect(reponse.body).toMatchObject({
        publicationState: 'READY',
        publishedAt: null,
      });
    });

    it('refuse en 422 une présentation déjà prête ou publiée', async () => {
      const projet = await creerUnProjet(jeu.a, 'Prête : refus');
      await rediger(jeu.a, projet.id, 'FR');
      await transition(jeu.a, projet.id, 'FR', 'ready');

      await request(app.getHttpServer())
        .post(`/api/projects/${projet.id}/presentations/FR/ready`)
        .set('Cookie', jeu.a.session)
        .expect(422)
        .expect(codeDErreur('portfolio.not_unpublished'));

      await transition(jeu.a, projet.id, 'FR', 'publish');
      await request(app.getHttpServer())
        .post(`/api/projects/${projet.id}/presentations/FR/ready`)
        .set('Cookie', jeu.a.session)
        .expect(422)
        .expect(codeDErreur('portfolio.not_unpublished'));
    });

    it("rend 404 sur une langue que le Projet n'a pas rédigée", async () => {
      const projet = await creerUnProjet(jeu.a, 'Prête : sans anglais');
      await rediger(jeu.a, projet.id, 'FR');

      await request(app.getHttpServer())
        .post(`/api/projects/${projet.id}/presentations/EN/ready`)
        .set('Cookie', jeu.a.session)
        .expect(404)
        .expect(codeDErreur('portfolio.presentation_not_found'));
    });

    it('refuse en 400 une langue inconnue', async () => {
      const projet = await creerUnProjet(jeu.a, 'Prête : langue');

      await request(app.getHttpServer())
        .post(`/api/projects/${projet.id}/presentations/fr-FR/ready`)
        .set('Cookie', jeu.a.session)
        .expect(400)
        .expect(champsEnErreur(['lang']));
    });

    it("rend 404 sur la présentation de l'autre Compte, et n'y touche pas", async () => {
      const deB = await creerUnProjet(jeu.b, 'Prête : Projet de B');
      await rediger(jeu.b, deB.id, 'FR');

      await request(app.getHttpServer())
        .post(`/api/projects/${deB.id}/presentations/FR/ready`)
        .set('Cookie', jeu.a.session)
        .expect(404)
        .expect(codeDErreur('project.not_found'));

      expect((await lister(jeu.b, deB.id))[0]?.publicationState).toBe(
        'UNPUBLISHED',
      );
    });

    it("n'accepte rien sans session", async () => {
      await request(app.getHttpServer())
        .post(`/api/projects/${INCONNU}/presentations/FR/ready`)
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('POST /projects/:id/presentations/:lang/publish', () => {
    it('publie une présentation prête, et date sa mise en ligne', async () => {
      const projet = await creerUnProjet(jeu.a, 'Publication : nominal');
      await rediger(jeu.a, projet.id, 'FR');
      await transition(jeu.a, projet.id, 'FR', 'ready');
      const avant = Date.now();

      const reponse = await request(app.getHttpServer())
        .post(`/api/projects/${projet.id}/presentations/FR/publish`)
        .set('Cookie', jeu.a.session)
        .expect(200)
        .expect(conformeA(UNE_PRESENTATION));

      expect(reponse.body.publicationState).toBe('PUBLISHED');
      expect(Date.parse(reponse.body.publishedAt)).toBeGreaterThanOrEqual(
        avant - 1_000,
      );
    });

    it('refuse en 422 une présentation qui n’est pas prête à publier', async () => {
      const projet = await creerUnProjet(jeu.a, 'Publication : pas prête');
      await rediger(jeu.a, projet.id, 'FR');

      await request(app.getHttpServer())
        .post(`/api/projects/${projet.id}/presentations/FR/publish`)
        .set('Cookie', jeu.a.session)
        .expect(422)
        .expect(codeDErreur('portfolio.not_ready'));

      expect((await lister(jeu.a, projet.id))[0]).toMatchObject({
        publicationState: 'UNPUBLISHED',
        publishedAt: null,
      });
    });

    it("rend 404 sur la présentation de l'autre Compte, et ne la publie pas", async () => {
      const deB = await creerUnProjet(jeu.b, 'Publication : Projet de B');
      await rediger(jeu.b, deB.id, 'FR');
      await transition(jeu.b, deB.id, 'FR', 'ready');

      await request(app.getHttpServer())
        .post(`/api/projects/${deB.id}/presentations/FR/publish`)
        .set('Cookie', jeu.a.session)
        .expect(404)
        .expect(codeDErreur('project.not_found'));

      expect((await lister(jeu.b, deB.id))[0]?.publicationState).toBe('READY');
    });

    it("n'accepte rien sans session", async () => {
      await request(app.getHttpServer())
        .post(`/api/projects/${INCONNU}/presentations/FR/publish`)
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('POST /projects/:id/presentations/:lang/unpublish', () => {
    it('retire du portfolio une présentation publiée', async () => {
      const projet = await creerUnProjet(jeu.a, 'Dépublication : nominal');
      await rediger(jeu.a, projet.id, 'FR');
      await transition(jeu.a, projet.id, 'FR', 'ready');
      await transition(jeu.a, projet.id, 'FR', 'publish');

      const reponse = await request(app.getHttpServer())
        .post(`/api/projects/${projet.id}/presentations/FR/unpublish`)
        .set('Cookie', jeu.a.session)
        .expect(200)
        .expect(conformeA(UNE_PRESENTATION));

      expect(reponse.body).toMatchObject({
        publicationState: 'UNPUBLISHED',
        publishedAt: null,
      });
    });

    it('refuse en 422 une présentation déjà non publiée', async () => {
      const projet = await creerUnProjet(jeu.a, 'Dépublication : refus');
      await rediger(jeu.a, projet.id, 'FR');

      await request(app.getHttpServer())
        .post(`/api/projects/${projet.id}/presentations/FR/unpublish`)
        .set('Cookie', jeu.a.session)
        .expect(422)
        .expect(codeDErreur('portfolio.already_unpublished'));
    });

    it("rend 404 sur la présentation de l'autre Compte, et la laisse en ligne", async () => {
      const deB = await creerUnProjet(jeu.b, 'Dépublication : Projet de B');
      await rediger(jeu.b, deB.id, 'FR');
      await transition(jeu.b, deB.id, 'FR', 'ready');
      await transition(jeu.b, deB.id, 'FR', 'publish');

      await request(app.getHttpServer())
        .post(`/api/projects/${deB.id}/presentations/FR/unpublish`)
        .set('Cookie', jeu.a.session)
        .expect(404)
        .expect(codeDErreur('project.not_found'));

      expect((await lister(jeu.b, deB.id))[0]?.publicationState).toBe(
        'PUBLISHED',
      );
    });

    it("n'accepte rien sans session", async () => {
      await request(app.getHttpServer())
        .post(`/api/projects/${INCONNU}/presentations/FR/unpublish`)
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  describe('DELETE /projects/:id', () => {
    it('emporte les présentations du Projet supprimé', async () => {
      const projet = await creerUnProjet(jeu.a, 'Suppression : rédigé');
      await rediger(jeu.a, projet.id, 'FR');
      await transition(jeu.a, projet.id, 'FR', 'ready');
      await transition(jeu.a, projet.id, 'FR', 'publish');
      await rediger(jeu.a, projet.id, 'EN');

      await request(app.getHttpServer())
        .delete(`/api/projects/${projet.id}`)
        .set('Cookie', jeu.a.session)
        .expect(204);

      await request(app.getHttpServer())
        .post(`/api/projects/${projet.id}/presentations/FR/unpublish`)
        .set('Cookie', jeu.a.session)
        .expect(404)
        .expect(codeDErreur('project.not_found'));
    });
  });

  async function creerUnProjet(
    compte: CompteDeTest,
    title: string,
  ): Promise<Project> {
    const reponse = await request(app.getHttpServer())
      .post('/api/projects')
      .set('Cookie', compte.session)
      .send({ title, notes: 'Des notes privées, qui ne sortent jamais.' })
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
      .send({ ...UN_TEXTE, ...texte })
      .expect(200);

    return reponse.body;
  }

  async function transition(
    compte: CompteDeTest,
    projectId: string,
    lang: 'FR' | 'EN',
    verbe: 'ready' | 'publish' | 'unpublish',
  ): Promise<PublicPresentation> {
    const reponse = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/presentations/${lang}/${verbe}`)
      .set('Cookie', compte.session)
      .expect(200);

    return reponse.body;
  }

  async function lister(
    compte: CompteDeTest,
    projectId: string,
  ): Promise<PublicPresentation[]> {
    const reponse = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/presentations`)
      .set('Cookie', compte.session)
      .expect(200);

    return reponse.body;
  }
});
