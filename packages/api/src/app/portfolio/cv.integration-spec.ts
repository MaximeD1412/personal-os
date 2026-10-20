import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { TAILLE_MAX_DU_CV, zCv } from '@personal-os/contracts';
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

const UN_CV = zCv.strict();
const DES_CV = z.array(UN_CV);

const UN_PDF = Buffer.from('%PDF-1.7\n% un CV de test\n%%EOF\n');

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

/**
 * Le CV du portfolio : un PDF par langue, rangé dans le stockage objet. Le
 * stockage est ici un dossier jetable du disque : aucun test n'atteint le
 * réseau. Le CV n'appartient à aucun Espace : les deux Comptes voient le même.
 */
describe('CV', () => {
  let authentik: FauxAuthentik;
  let app: NestExpressApplication;
  let jeu: JeuDEspaces;
  let stockage: string;

  beforeAll(async () => {
    authentik = await demarrerFauxAuthentik();
    stockage = await mkdtemp(join(tmpdir(), 'personal-os-cv-'));

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

  describe('PUT /cv/:lang', () => {
    it('téléverse un PDF, et rend ce qui a été rangé, conforme au contrat', async () => {
      const avant = Date.now();

      const reponse = await request(app.getHttpServer())
        .put('/api/cv/FR')
        .set('Cookie', jeu.a.session)
        .attach('file', UN_PDF, {
          filename: 'Mon CV.pdf',
          contentType: 'application/pdf',
        })
        .expect(200)
        .expect(conformeA(UN_CV));

      expect(reponse.body).toMatchObject({ lang: 'FR', size: UN_PDF.length });
      expect(Date.parse(reponse.body.uploadedAt)).toBeGreaterThanOrEqual(
        avant - 1_000,
      );
    });

    it("remplace le CV d'une langue, sans toucher à l'autre", async () => {
      const nouveau = Buffer.from('%PDF-2.0\n% la nouvelle version\n%%EOF\n');
      await request(app.getHttpServer())
        .put('/api/cv/EN')
        .set('Cookie', jeu.a.session)
        .attach('file', UN_PDF, 'cv.pdf')
        .expect(200);
      await request(app.getHttpServer())
        .put('/api/cv/FR')
        .set('Cookie', jeu.a.session)
        .attach('file', UN_PDF, 'cv.pdf')
        .expect(200);

      await request(app.getHttpServer())
        .put('/api/cv/EN')
        .set('Cookie', jeu.b.session)
        .attach('file', nouveau, 'cv.pdf')
        .expect(200);

      const en = await request(app.getHttpServer())
        .get('/api/cv/EN')
        .set('Cookie', jeu.a.session)
        .buffer(true)
        .parse(binaire)
        .expect(200);
      const fr = await request(app.getHttpServer())
        .get('/api/cv/FR')
        .set('Cookie', jeu.a.session)
        .buffer(true)
        .parse(binaire)
        .expect(200);
      expect((en.body as Buffer).equals(nouveau)).toBe(true);
      expect((fr.body as Buffer).equals(UN_PDF)).toBe(true);
    });

    it("refuse en 422 un fichier qui n'est pas un PDF, même annoncé comme tel", async () => {
      await request(app.getHttpServer())
        .put('/api/cv/FR')
        .set('Cookie', jeu.a.session)
        .attach('file', Buffer.from('<html>pas un CV</html>'), {
          filename: 'cv.pdf',
          contentType: 'application/pdf',
        })
        .expect(422)
        .expect(codeDErreur('portfolio.cv_invalid'));
    });

    it('refuse en 422 un PDF de plus de 5 Mo', async () => {
      const tropGros = Buffer.concat([
        UN_PDF,
        Buffer.alloc(TAILLE_MAX_DU_CV + 1 - UN_PDF.length, 0x20),
      ]);

      await request(app.getHttpServer())
        .put('/api/cv/FR')
        .set('Cookie', jeu.a.session)
        .attach('file', tropGros, 'cv.pdf')
        .expect(422)
        .expect(codeDErreur('portfolio.cv_invalid'));
    });

    it('accepte un PDF de 5 Mo tout juste', async () => {
      const limite = Buffer.concat([
        UN_PDF,
        Buffer.alloc(TAILLE_MAX_DU_CV - UN_PDF.length, 0x20),
      ]);

      const reponse = await request(app.getHttpServer())
        .put('/api/cv/EN')
        .set('Cookie', jeu.a.session)
        .attach('file', limite, 'cv.pdf')
        .expect(200);

      expect(reponse.body.size).toBe(TAILLE_MAX_DU_CV);
    });

    it('refuse en 400 une requête sans fichier, sur le champ `file`', async () => {
      await request(app.getHttpServer())
        .put('/api/cv/FR')
        .set('Cookie', jeu.a.session)
        .field('autre', 'valeur')
        .expect(400)
        .expect(champsEnErreur(['file']));
    });

    it('refuse en 400 une langue inconnue, sur le champ `lang`', async () => {
      await request(app.getHttpServer())
        .put('/api/cv/DE')
        .set('Cookie', jeu.a.session)
        .attach('file', UN_PDF, 'cv.pdf')
        .expect(400)
        .expect(champsEnErreur(['lang']));
    });

    it("n'accepte rien sans session", async () => {
      await request(app.getHttpServer())
        .put('/api/cv/FR')
        .attach('file', UN_PDF, 'cv.pdf')
        .expect(401);
    });
  });

  describe('GET /cv/:lang', () => {
    it('télécharge le PDF tel quel, sous un nom par langue', async () => {
      await request(app.getHttpServer())
        .put('/api/cv/FR')
        .set('Cookie', jeu.a.session)
        .attach('file', UN_PDF, 'Mon CV.pdf')
        .expect(200);

      const reponse = await request(app.getHttpServer())
        .get('/api/cv/FR')
        .set('Cookie', jeu.a.session)
        .buffer(true)
        .parse(binaire)
        .expect(200)
        .expect('Content-Type', 'application/pdf')
        .expect('Content-Disposition', 'attachment; filename="cv-fr.pdf"');

      expect((reponse.body as Buffer).equals(UN_PDF)).toBe(true);
    });

    it("rend un 404 quand la langue n'a pas encore de CV", async () => {
      // Une racine vide : aucun CV n'y a été déposé.
      const vide = await mkdtemp(join(tmpdir(), 'personal-os-cv-vide-'));
      process.env['STORAGE_DISK_DIR'] = vide;
      const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      const autre = moduleRef.createNestApplication<NestExpressApplication>();
      autre.setGlobalPrefix('api');
      await autre.init();

      try {
        await request(autre.getHttpServer())
          .get('/api/cv/EN')
          .set('Cookie', jeu.a.session)
          .expect(404)
          .expect(codeDErreur('portfolio.cv_not_found'));
        await request(autre.getHttpServer())
          .get('/api/cv')
          .set('Cookie', jeu.a.session)
          .expect(200)
          .expect([]);
      } finally {
        await autre.close();
        process.env['STORAGE_DISK_DIR'] = stockage;
        await rm(vide, { recursive: true, force: true });
      }
    });

    it('refuse en 400 une langue inconnue', async () => {
      await request(app.getHttpServer())
        .get('/api/cv/fr')
        .set('Cookie', jeu.a.session)
        .expect(400)
        .expect(champsEnErreur(['lang']));
    });

    it("n'expose rien sans session", async () => {
      await request(app.getHttpServer()).get('/api/cv/FR').expect(401);
    });
  });

  describe('GET /cv', () => {
    it('liste les CV téléversés, une ligne par langue, conforme au contrat', async () => {
      await request(app.getHttpServer())
        .put('/api/cv/FR')
        .set('Cookie', jeu.a.session)
        .attach('file', UN_PDF, 'cv.pdf')
        .expect(200);
      await request(app.getHttpServer())
        .put('/api/cv/EN')
        .set('Cookie', jeu.a.session)
        .attach('file', UN_PDF, 'cv.pdf')
        .expect(200);

      const reponse = await request(app.getHttpServer())
        .get('/api/cv')
        .set('Cookie', jeu.b.session)
        .expect(200)
        .expect(conformeA(DES_CV));

      expect(reponse.body).toEqual([
        expect.objectContaining({ lang: 'FR', size: UN_PDF.length }),
        expect.objectContaining({ lang: 'EN', size: UN_PDF.length }),
      ]);
    });

    it("n'expose rien sans session", async () => {
      await request(app.getHttpServer()).get('/api/cv').expect(401);
    });
  });
});
