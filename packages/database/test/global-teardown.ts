import { supprimerLaBase } from './base-jetable';

export default async function globalTeardown(): Promise<void> {
  const base = process.env['TEST_BASE_DATABASE_URL'];
  const nom = process.env['TEST_DATABASE_NAME'];

  if (base && nom) {
    await supprimerLaBase(base, nom);
  }
}
