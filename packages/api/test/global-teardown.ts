import { dropDatabase } from './disposable-database';

export default async function globalTeardown(): Promise<void> {
  const baseUrl = process.env['TEST_BASE_DATABASE_URL'];
  const name = process.env['TEST_DATABASE_NAME'];

  if (baseUrl && name) {
    await dropDatabase(baseUrl, name);
  }
}
