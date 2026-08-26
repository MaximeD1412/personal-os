import {
  createDatabase,
  disposableDatabaseUrl,
  migrateDatabase,
} from './disposable-database';

const DEFAULT_BASE_URL =
  'postgresql://personalos:personalos@localhost:5432/postgres?schema=public';

export default async function globalSetup(): Promise<void> {
  const baseUrl =
    process.env['TEST_DATABASE_URL'] ??
    process.env['DATABASE_URL'] ??
    DEFAULT_BASE_URL;

  const name = `personalos_test_${process.pid}_${Date.now()}`;
  const databaseUrl = disposableDatabaseUrl(baseUrl, name);

  await createDatabase(baseUrl, name);
  migrateDatabase(databaseUrl);

  // Lues par le teardown, et héritées par les workers Jest.
  process.env['TEST_BASE_DATABASE_URL'] = baseUrl;
  process.env['TEST_DATABASE_NAME'] = name;
  process.env['DATABASE_URL'] = databaseUrl;

  // L'API refuse de démarrer sans configuration d'authentification, et c'est
  // voulu : une pile qui se lève sans savoir authentifier passerait sa
  // vérification de santé. Toute campagne qui monte AppModule a donc besoin de
  // ces valeurs, même celles qui n'authentifient rien — les spécifications de
  // l'authentification, elles, remplacent l'émetteur par leur propre
  // fournisseur de laboratoire.
  process.env['OIDC_ISSUER'] ??= 'http://authentik.invalide.test/o/personal-os';
  process.env['OIDC_CLIENT_ID'] ??= 'personal-os';
  process.env['OIDC_CLIENT_SECRET'] ??= 'secret-de-test';
  process.env['OIDC_REDIRECT_URI'] ??=
    'http://app.exemple.test/api/auth/callback';
  process.env['DASHBOARD_URL'] ??= 'http://app.exemple.test/';
  process.env['AUTH_ALLOWED_EMAILS'] ??= 'admis@exemple.test';
}
