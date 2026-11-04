import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  zBackupStatus,
  type ModuleSummary,
  type Todo,
} from '@personal-os/contracts';
import { PrismaService } from '@personal-os/database';
import request from 'supertest';
import { codeDErreur, champsEnErreur } from '../../../test/code-d-erreur';
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
import { Horloge } from '../dashboard/horloge';

const REDIRECT_URI = 'http://app.exemple.test/api/auth/callback';
const DASHBOARD_URL = 'http://app.exemple.test/';
const ADRESSE_A = 'a@exemple.test';
const ADRESSE_B = 'b@exemple.test';

const JETON = 'jeton-de-sauvegarde-de-test';
const ROUTE = '/api/internal/backup-status';

/** L'instant des lectures du tableau de bord : le 8 mars 2034, 10 h à Paris. */
const MAINTENANT = new Date('2034-03-08T09:00:00.000Z');

describe('POST /api/internal/backup-status', () => {
  let authentik: FauxAuthentik;
  let app: INestApplication;
  let prisma: PrismaService;
  let jeu: JeuDEspaces;

  beforeAll(async () => {
    authentik = await demarrerFauxAuthentik();

    process.env['OIDC_ISSUER'] = authentik.issuer;
    process.env['OIDC_CLIENT_ID'] = 'personal-os';
    process.env['OIDC_CLIENT_SECRET'] = 'secret-de-test';
    process.env['OIDC_REDIRECT_URI'] = REDIRECT_URI;
    process.env['DASHBOARD_URL'] = DASHBOARD_URL;
    process.env['AUTH_ALLOWED_EMAILS'] = `${ADRESSE_A},${ADRESSE_B}`;
    process.env['BACKUP_STATUS_TOKEN'] = JETON;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Horloge)
      .useValue({ maintenant: () => MAINTENANT })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);

    jeu = await poserLeJeuDEspaces(app, authentik, [ADRESSE_A, ADRESSE_B]);
  });

  afterAll(async () => {
    delete process.env['BACKUP_STATUS_TOKEN'];
    await app?.close();
    await authentik?.close();
  });

  beforeEach(async () => {
    await prisma.backupStatus.deleteMany();
  });

  function transmettre(corps: object, jeton: string | null = JETON) {
    const requete = request(app.getHttpServer()).post(ROUTE);
    return (jeton === null ? requete : requete.set('Authorization', `Bearer ${jeton}`)).send(corps);
  }

  async function resumeDesSauvegardes(): Promise<ModuleSummary | undefined> {
    const { body } = await request(app.getHttpServer())
      .get('/api/dashboard/summaries')
      .set('Cookie', jeu.a.session)
      .expect(200);
    return (body as ModuleSummary[]).find(({ module }) => module === 'backup');
  }

  async function aFaireDesSauvegardes(): Promise<Todo[]> {
    const { body } = await request(app.getHttpServer())
      .get('/api/dashboard/todos')
      .set('Cookie', jeu.b.session)
      .expect(200);
    return (body as Todo[]).filter(({ module }) => module === 'backup');
  }

  it("enregistre une sauvegarde réussie, que le tableau de bord montre comme la dernière", async () => {
    await transmettre({
      outcome: 'SUCCEEDED',
      finishedAt: '2034-03-08T02:41:00.000Z',
    })
      .expect(200)
      .expect(conformeA(zBackupStatus.strict()))
      .expect(({ body }) => {
        expect(body).toEqual({
          lastSuccessAt: '2034-03-08T02:41:00.000Z',
          lastRunAt: '2034-03-08T02:41:00.000Z',
          lastError: null,
        });
      });

    expect(await resumeDesSauvegardes()).toEqual({
      module: 'backup',
      indicators: [
        {
          key: 'backup_last_success',
          label: 'Dernière sauvegarde réussie',
          value: '2034-03-08T02:41:00.000Z',
        },
      ],
      signals: [],
    });
    expect(await aFaireDesSauvegardes()).toEqual([]);
  });
  it("garde la dernière réussite quand une exécution échoue, avec sa cause", async () => {
    await transmettre({
      outcome: 'SUCCEEDED',
      finishedAt: '2034-03-07T02:40:00.000Z',
    }).expect(200);

    await transmettre({
      outcome: 'FAILED',
      finishedAt: '2034-03-08T02:35:00.000Z',
      error: 'restic check a échoué',
    })
      .expect(200)
      .expect(conformeA(zBackupStatus.strict()))
      .expect(({ body }) => {
        expect(body).toEqual({
          lastSuccessAt: '2034-03-07T02:40:00.000Z',
          lastRunAt: '2034-03-08T02:35:00.000Z',
          lastError: 'restic check a échoué',
        });
      });

    // Une réussite efface la cause du dernier échec.
    await transmettre({
      outcome: 'SUCCEEDED',
      finishedAt: '2034-03-08T03:10:00.000Z',
    })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          lastSuccessAt: '2034-03-08T03:10:00.000Z',
          lastRunAt: '2034-03-08T03:10:00.000Z',
          lastError: null,
        });
      });
  });

  it.each([
    [{ outcome: 'SUCCEEDED', finishedAt: '8 mars' }, ['finishedAt']],
    [{ outcome: 'FAILED', finishedAt: '2034-03-08T02:35:00.000Z' }, ['error']],
    [{ outcome: 'PARTIAL', finishedAt: '2034-03-08T02:35:00.000Z' }, ['outcome']],
  ])('refuse un rapport mal formé (%j) : 400 sur le champ en cause', async (corps, champs) => {
    await transmettre(corps)
      .expect(400)
      .expect(champsEnErreur(champs));
    expect(await prisma.backupStatus.count()).toBe(0);
  });

  it.each([
    ['sans jeton', null],
    ['avec un mauvais jeton', 'pas-le-bon-jeton'],
    ['avec le jeton pour préfixe', `${JETON}x`],
  ])('refuse un rapport %s : 401', async (_cas, jeton) => {
    await transmettre(
      { outcome: 'SUCCEEDED', finishedAt: '2034-03-08T02:41:00.000Z' },
      jeton,
    )
      .expect(401)
      .expect(codeDErreur('backup.token_required'));
    expect(await prisma.backupStatus.count()).toBe(0);
  });

  it("refuse tout rapport quand aucun jeton n'est configuré", async () => {
    delete process.env['BACKUP_STATUS_TOKEN'];
    try {
      await transmettre(
        { outcome: 'SUCCEEDED', finishedAt: '2034-03-08T02:41:00.000Z' },
        '',
      )
        .expect(401)
        .expect(codeDErreur('backup.token_required'));
    } finally {
      process.env['BACKUP_STATUS_TOKEN'] = JETON;
    }
    expect(await prisma.backupStatus.count()).toBe(0);
  });

  it("répond 404 à une requête relayée par un proxy, même avec le jeton", async () => {
    await request(app.getHttpServer())
      .post(ROUTE)
      .set('Authorization', `Bearer ${JETON}`)
      .set('X-Forwarded-For', '203.0.113.7')
      .send({ outcome: 'SUCCEEDED', finishedAt: '2034-03-08T02:41:00.000Z' })
      .expect(404);
    expect(await prisma.backupStatus.count()).toBe(0);
  });

  it("n'est pas lisible avec une session de Compte", async () => {
    await request(app.getHttpServer())
      .post(ROUTE)
      .set('Cookie', jeu.a.session)
      .send({ outcome: 'SUCCEEDED', finishedAt: '2034-03-08T02:41:00.000Z' })
      .expect(401)
      .expect(codeDErreur('backup.token_required'));
  });

  describe('au tableau de bord', () => {
    it("signale aux deux Comptes une dernière réussite de plus de 26 heures", async () => {
      // Le 7 mars à 7 h 59 (Paris) : 26 h et 1 min avant 10 h le 8.
      await transmettre({
        outcome: 'SUCCEEDED',
        finishedAt: '2034-03-07T06:59:00.000Z',
      }).expect(200);
      await transmettre({
        outcome: 'FAILED',
        finishedAt: '2034-03-08T02:35:00.000Z',
        error: 'dépôt injoignable',
      }).expect(200);

      expect((await resumeDesSauvegardes())?.signals).toEqual([
        {
          kind: 'backup.stale',
          ref: 'backup-status',
          label: 'Dernière sauvegarde réussie il y a plus de 26 heures',
          dueOn: '2034-03-08',
          link: '/',
        },
      ]);
      expect(await aFaireDesSauvegardes()).toEqual([
        expect.objectContaining({
          module: 'backup',
          label: 'Dernière sauvegarde réussie il y a plus de 26 heures',
        }),
      ]);
    });

    it("ne signale rien à 26 heures tout juste", async () => {
      await transmettre({
        outcome: 'SUCCEEDED',
        finishedAt: '2034-03-07T07:00:00.000Z',
      }).expect(200);

      expect((await resumeDesSauvegardes())?.signals).toEqual([]);
    });

    it("signale qu'aucune sauvegarde réussie n'a été reçue", async () => {
      expect(await resumeDesSauvegardes()).toEqual({
        module: 'backup',
        indicators: [],
        signals: [
          {
            kind: 'backup.stale',
            ref: 'backup-status',
            label: "Aucune sauvegarde réussie n'a été reçue",
            link: '/',
          },
        ],
      });
    });
  });
});
