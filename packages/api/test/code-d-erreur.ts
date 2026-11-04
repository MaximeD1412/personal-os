import { type ApiError, zApiError } from '@personal-os/contracts';
import type { Response } from 'supertest';

/**
 * Des assertions supertest sur l'enveloppe d'erreur (ADR 0030) : le corps la
 * respecte exactement, et porte le `code` attendu.
 */
export function codeDErreur(code: string): (reponse: Response) => void {
  return (reponse) => {
    expect(enveloppe(reponse)).toMatchObject({ status: reponse.status, code });
  };
}

/** Un 400 de validation dont `fields` pointe ces chemins, dans cet ordre. */
export function champsEnErreur(chemins: string[]): (reponse: Response) => void {
  return (reponse) => {
    const corps = enveloppe(reponse);
    expect(corps.code).toBe('request.invalid');
    expect(corps.fields?.map(({ path }) => path)).toEqual(chemins);
  };
}

function enveloppe(reponse: Response): ApiError {
  return zApiError.strict().parse(reponse.body);
}
