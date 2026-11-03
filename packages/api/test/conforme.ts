import type { Response } from 'supertest';
import type { z } from 'zod';

/**
 * Une assertion supertest : le corps respecte le schéma de sortie de la route
 * (ADR 0030). Passer un schéma strict (`.strict()`) prouve en plus qu'aucun
 * champ interne ne fuite.
 */
export function conformeA(schema: z.ZodType): (reponse: Response) => void {
  return (reponse) => {
    schema.parse(reponse.body);
  };
}
