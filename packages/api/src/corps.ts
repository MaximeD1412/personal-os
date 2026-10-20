import type { NestExpressApplication } from '@nestjs/platform-express';

/**
 * La taille la plus grande d'un body JSON. Les 100 Ko d'Express refusaient en
 * 413, avant toute validation, des entrées conformes aux contrats : les notes
 * d'un Projet vont jusqu'à 100 000 caractères, qui pèsent jusqu'à six octets
 * chacun une fois encodés en JSON (`\u0001`), et ses 50 liens jusqu'à
 * 2 048 caractères. Le plus gros Projet conforme tient sous 700 Ko.
 */
export const LIMITE_DU_CORPS_JSON = '1mb';

/** À appeler avant `init()`, pour que ce parseur remplace celui par défaut. */
export function accepterLesCorpsJson(app: NestExpressApplication): void {
  app.useBodyParser('json', { limit: LIMITE_DU_CORPS_JSON });
}
