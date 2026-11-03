import { creerLaBase, migrerLaBase, urlDeLaBase } from './disposable-database';

const BASE_PAR_DEFAUT =
  'postgresql://personalos:personalos@localhost:5432/postgres?schema=public';

export default async function globalSetup(): Promise<void> {
  const base =
    process.env['TEST_DATABASE_URL'] ??
    process.env['DATABASE_URL'] ??
    BASE_PAR_DEFAUT;

  const nom = `personalos_test_database_${process.pid}_${Date.now()}`;
  const url = urlDeLaBase(base, nom);

  await creerLaBase(base, nom);
  migrerLaBase(url);

  process.env['TEST_BASE_DATABASE_URL'] = base;
  process.env['TEST_DATABASE_NAME'] = nom;
  process.env['DATABASE_URL'] = url;
}
