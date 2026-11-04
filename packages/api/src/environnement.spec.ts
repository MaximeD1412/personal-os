import { verifierLEnvironnement } from './environnement';

describe('verifierLEnvironnement', () => {
  const STAGING = {
    APP_ENV: 'staging',
    PROD_DATABASE_HOST: 'db,personal-os-db,127.0.0.1:5433',
    DATABASE_URL:
      'postgresql://personalos:secret@staging-db:5432/personalos?schema=public',
  };

  describe('APP_ENV', () => {
    it('refuse de démarrer sans APP_ENV', () => {
      expect(() => verifierLEnvironnement({})).toThrow(
        /APP_ENV est absent/,
      );
    });

    it.each(['prod', 'Production', ' staging', 'test', ''])(
      'refuse de démarrer avec APP_ENV=%p, une valeur inconnue',
      (valeur) => {
        expect(() => verifierLEnvironnement({ APP_ENV: valeur })).toThrow(
          /APP_ENV/,
        );
      },
    );

    it.each(['development', 'production'])(
      'laisse démarrer avec APP_ENV=%s',
      (valeur) => {
        expect(() =>
          verifierLEnvironnement({ APP_ENV: valeur }),
        ).not.toThrow();
      },
    );
  });

  describe('staging', () => {
    it('laisse démarrer sur la base de staging', () => {
      expect(() => verifierLEnvironnement(STAGING)).not.toThrow();
    });

    it("refuse de démarrer sur l'hôte `db` du projet de production", () => {
      expect(() =>
        verifierLEnvironnement({
          ...STAGING,
          DATABASE_URL: 'postgresql://personalos:secret@db:5432/personalos',
        }),
      ).toThrow(/base de production/);
    });

    it('reconnaît chaque hôte de la liste, sans égard à la casse', () => {
      expect(() =>
        verifierLEnvironnement({
          ...STAGING,
          DATABASE_URL: 'postgresql://u:p@Personal-OS-DB:5432/personalos',
        }),
      ).toThrow(/base de production/);
    });

    it('reconnaît un hôte donné avec son port, et seulement sur ce port', () => {
      expect(() =>
        verifierLEnvironnement({
          ...STAGING,
          DATABASE_URL: 'postgresql://u:p@127.0.0.1:5433/personalos',
        }),
      ).toThrow(/base de production/);
      expect(() =>
        verifierLEnvironnement({
          ...STAGING,
          DATABASE_URL: 'postgresql://u:p@127.0.0.1:5434/personalos',
        }),
      ).not.toThrow();
    });

    it('prend le port par défaut de PostgreSQL quand l’URL n’en donne pas', () => {
      expect(() =>
        verifierLEnvironnement({
          ...STAGING,
          PROD_DATABASE_HOST: 'db:5432',
          DATABASE_URL: 'postgresql://u:p@db/personalos',
        }),
      ).toThrow(/base de production/);
    });

    it("ne cite jamais le mot de passe de l'URL dans son refus", () => {
      expect(() =>
        verifierLEnvironnement({
          ...STAGING,
          DATABASE_URL: 'postgresql://u:mot-de-passe-secret@db:5432/x',
        }),
      ).toThrow(
        expect.objectContaining({
          message: expect.not.stringContaining('mot-de-passe-secret'),
        }),
      );
    });

    // Le pilote (pg) et le moteur de migration lisent l'hôte et le port
    // ailleurs que dans l'autorité de l'URL : en paramètre de requête, encodé,
    // ou dans PGHOST quand l'URL n'en donne pas. Ce que le garde-fou ne sait
    // pas lire comme eux, il le refuse.
    it.each([
      ['un hôte en paramètre de requête', 'postgresql://u:p@staging-db:5432/personalos?host=personal-os-db'],
      ['un hôte en paramètre de requête, en majuscules', 'postgresql://u:p@staging-db:5432/personalos?HOST=db'],
      ['une adresse en paramètre de requête', 'postgresql://u:p@staging-db:5432/personalos?hostaddr=10.0.0.2'],
      ['un port en paramètre de requête', 'postgresql://u:p@staging-db:5432/personalos?port=5433'],
      ['un hôte encodé', 'postgresql://u:p@%70ersonal-os-db:5432/personalos'],
      ['plusieurs hôtes', 'postgresql://u:p@staging-db:5432,db:5432/personalos'],
      ['une URL sans hôte, qui laisse PGHOST décider', 'postgresql://u:p@/personalos'],
      ['un autre protocole que PostgreSQL', 'socket://u:p@/var/run/postgresql?db=personalos'],
    ])('refuse de démarrer sur %s', (_cas, url) => {
      expect(() =>
        verifierLEnvironnement({ ...STAGING, DATABASE_URL: url }),
      ).toThrow(/DATABASE_URL/);
    });

    it('reconnaît un hôte de la prod écrit avec un point final', () => {
      expect(() =>
        verifierLEnvironnement({
          ...STAGING,
          DATABASE_URL: 'postgresql://u:p@personal-os-db.:5432/personalos',
        }),
      ).toThrow(/base de production/);
    });

    it('laisse démarrer avec les paramètres ordinaires de la requête', () => {
      expect(() =>
        verifierLEnvironnement({
          ...STAGING,
          DATABASE_URL:
            'postgres://u:p@staging-db/personalos?schema=public&sslmode=disable',
        }),
      ).not.toThrow();
    });

    it('refuse de démarrer sans PROD_DATABASE_HOST : rien ne dirait où est la prod', () => {
      expect(() =>
        verifierLEnvironnement({ ...STAGING, PROD_DATABASE_HOST: ' , ' }),
      ).toThrow(/PROD_DATABASE_HOST/);
    });

    it('refuse de démarrer sans DATABASE_URL lisible', () => {
      expect(() =>
        verifierLEnvironnement({ ...STAGING, DATABASE_URL: 'pas une url' }),
      ).toThrow(/DATABASE_URL/);
      expect(() =>
        verifierLEnvironnement({ ...STAGING, DATABASE_URL: undefined }),
      ).toThrow(/DATABASE_URL/);
    });
  });
});
