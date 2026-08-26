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
}
