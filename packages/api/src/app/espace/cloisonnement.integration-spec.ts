import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Event, EventOccurrence, Scope } from '@personal-os/contracts';
import request from 'supertest';
import {
  demarrerFauxAuthentik,
  type FauxAuthentik,
} from '../../../test/faux-authentik';
import {
  poserLeJeuDEspaces,
  type JeuDEspaces,
} from '../../../test/jeu-d-espaces';
import { ModuleRestreint } from '../../../test/module-restreint';
import { champsEnErreur, codeDErreur } from '../../../test/code-d-erreur';
import { AppModule } from '../app.module';

const REDIRECT_URI = 'http://app.exemple.test/api/auth/callback';
const DASHBOARD_URL = 'http://app.exemple.test/';
const ADRESSE_A = 'a@exemple.test';
const ADRESSE_B = 'b@exemple.test';

/** De quoi couvrir tous les Événements de cette campagne. */
const TOUT = {
  from: '2026-01-01T00:00:00.000Z',
  to: '2026-12-31T23:59:59.999Z',
};

/**
 * Les tests de non-exposition. Ils portent sur le **mécanisme** — la garde
 * d'Espace posée dans l'accès aux données — et non sur chaque endpoint pris
 * séparément (ADR 0016). L'Événement leur sert de sujet : ce qui vaut pour
 * lui vaut pour tout modèle qui porte un Espace, puisque c'est le même chemin
 * de code.
 */
describe('Cloisonnement par Espace', () => {
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

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, ModuleRestreint],
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

  describe('Le Foyer et les trois Espaces', () => {
    it('donne à chaque Compte son Espace personnel et celui du Foyer', async () => {
      const reponse = await request(app.getHttpServer())
        .get('/api/espaces')
        .set('Cookie', jeu.a.session)
        .expect(200);

      expect((reponse.body as Scope[]).map(({ kind }) => kind).sort()).toEqual([
        'HOUSEHOLD',
        'PERSONAL',
      ]);
    });

    it('ne fait exister que trois Espaces pour deux Comptes', () => {
      const tous = new Set([
        jeu.a.espacePersonnel,
        jeu.b.espacePersonnel,
        jeu.espaceFoyer,
      ]);

      expect(tous.size).toBe(3);
    });

    it('donne aux deux Comptes le même Espace foyer', async () => {
      const sien = await request(app.getHttpServer())
        .get('/api/espaces')
        .set('Cookie', jeu.b.session)
        .expect(200);

      expect(
        (sien.body as Scope[]).find(({ kind }) => kind === 'HOUSEHOLD')?.id,
      ).toBe(jeu.espaceFoyer);
    });
  });

  describe("Ce qu'un Compte ne voit pas", () => {
    it("ne rend jamais un Événement de l'Espace personnel de l'autre", async () => {
      const sienne = await creer(jeu.b, 'secret de B', jeu.b.espacePersonnel);

      const vues = await request(app.getHttpServer())
        .get('/api/events')
        .query(TOUT)
        .set('Cookie', jeu.a.session)
        .expect(200);

      expect((vues.body as EventOccurrence[]).map(({ eventId }) => eventId)).not.toContain(
        sienne.id,
      );
    });

    it('ne le rend pas davantage à qui devine son identifiant', async () => {
      const sienne = await creer(jeu.b, 'à deviner', jeu.b.espacePersonnel);

      await request(app.getHttpServer())
        .patch(`/api/events/${sienne.id}`)
        .set('Cookie', jeu.a.session)
        .send({ title: 'volé' })
        .expect(404)
        .expect(codeDErreur('event.not_found'));
    });

    it("ne laisse pas modifier un Événement de l'autre Espace personnel", async () => {
      const sienne = await creer(jeu.b, 'intacte', jeu.b.espacePersonnel);

      await request(app.getHttpServer())
        .patch(`/api/events/${sienne.id}`)
        .set('Cookie', jeu.a.session)
        .send({ title: 'modifié' })
        .expect(404);

      const relue = await request(app.getHttpServer())
        .get('/api/events')
        .query(TOUT)
        .set('Cookie', jeu.b.session)
        .expect(200);

      expect(
        (relue.body as EventOccurrence[]).find(({ eventId }) => eventId === sienne.id)?.title,
      ).toBe('intacte');
    });

    it("ne laisse pas supprimer un Événement de l'autre Espace personnel", async () => {
      const sienne = await creer(jeu.b, 'survivante', jeu.b.espacePersonnel);

      await request(app.getHttpServer())
        .delete(`/api/events/${sienne.id}`)
        .set('Cookie', jeu.a.session)
        .expect(404);

      const relue = await request(app.getHttpServer())
        .get('/api/events')
        .query(TOUT)
        .set('Cookie', jeu.b.session)
        .expect(200);

      expect((relue.body as EventOccurrence[]).map(({ eventId }) => eventId)).toContain(sienne.id);
    });

    it("refuse d'écrire dans l'Espace personnel de l'autre", async () => {
      await request(app.getHttpServer())
        .post('/api/events')
        .set('Cookie', jeu.a.session)
        .send(saisie('intrusion', jeu.b.espacePersonnel))
        .expect(403)
        .expect(codeDErreur('scope.out_of_reach'));
    });
  });

  describe('Ce que les deux Comptes voient pareil', () => {
    it("rend à chacun le même Événement de l'Espace foyer", async () => {
      const commune = await creer(jeu.a, 'vacances', jeu.espaceFoyer);

      for (const compte of [jeu.a, jeu.b]) {
        const vues = await request(app.getHttpServer())
          .get('/api/events')
        .query(TOUT)
          .set('Cookie', compte.session)
          .expect(200);

        expect((vues.body as EventOccurrence[]).map(({ eventId }) => eventId)).toContain(
          commune.id,
        );
      }
    });

    it("laisse l'autre Compte modifier un Événement de l'Espace foyer", async () => {
      const commune = await creer(jeu.a, 'à préciser', jeu.espaceFoyer);

      await request(app.getHttpServer())
        .patch(`/api/events/${commune.id}`)
        .set('Cookie', jeu.b.session)
        .send({ title: 'précisé' })
        .expect(200);
    });
  });

  describe("Ce qu'un module accepte", () => {
    it("refuse un Espace que le module n'accepte pas", async () => {
      await request(app.getHttpServer())
        .post('/api/foyer-seul')
        .set('Cookie', jeu.a.session)
        .send(saisie('personnel', jeu.a.espacePersonnel))
        .expect(403)
        .expect(codeDErreur('scope.kind_refused'));
    });

    it("accepte celui qu'il déclare", async () => {
      await request(app.getHttpServer())
        .post('/api/foyer-seul')
        .set('Cookie', jeu.a.session)
        .send(saisie('commun', jeu.espaceFoyer))
        .expect(201);
    });

    it('échoue bruyamment quand un module ne déclare aucun Espace', async () => {
      await request(app.getHttpServer())
        .post('/api/sans-declaration')
        .set('Cookie', jeu.a.session)
        .send(saisie('muet', jeu.espaceFoyer))
        .expect(500)
        .expect(codeDErreur('scope.undeclared'));
    });

    // Le refus par la garde elle-même est vérifié en test unitaire : ici, la
    // saisie n'atteint même pas l'accès aux données.
    it('refuse une saisie qui ne nomme aucun Espace', async () => {
      await request(app.getHttpServer())
        .post('/api/events')
        .set('Cookie', jeu.a.session)
        .send({
          title: 'sans espace',
          startsAt: '2026-06-15T08:00:00.000Z',
          category: 'OTHER',
        })
        .expect(400)
        .expect(champsEnErreur(['scopeId']));
    });
  });

  describe('Sans session', () => {
    it("n'expose rien de cloisonné", async () => {
      await request(app.getHttpServer())
        .get('/api/events')
        .query(TOUT)
        .expect(401)
        .expect(codeDErreur('auth.required'));
      await request(app.getHttpServer())
        .get('/api/espaces')
        .expect(401)
        .expect(codeDErreur('auth.required'));
    });
  });

  async function creer(
    compte: JeuDEspaces['a'],
    title: string,
    scopeId: string,
  ): Promise<Event> {
    const reponse = await request(app.getHttpServer())
      .post('/api/events')
      .set('Cookie', compte.session)
      .send(saisie(title, scopeId))
      .expect(201);

    return reponse.body;
  }
});

/** Un Événement ponctuel, dans la période que la campagne relit. */
function saisie(title: string, scopeId: string) {
  return {
    title,
    startsAt: '2026-06-15T08:00:00.000Z',
    category: 'OTHER',
    scopeId,
  };
}
