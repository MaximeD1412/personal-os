import type { NestExpressApplication } from '@nestjs/platform-express';

/**
 * La taille la plus grande d'un body JSON. Les 100 Ko d'Express refusaient en
 * 413, avant toute validation, des entrées conformes aux contrats. Le pire
 * encodage JSON d'un caractère pèse six octets (`\u0001`) : un Projet conforme
 * où chaque champ en est rempli (titre de 120 caractères, notes de 100 000,
 * 50 liens de 120 et 2 048) pèse environ 1,25 Mo.
 */
export const LIMITE_DU_CORPS_JSON = '2mb';

/** À appeler avant `init()`, pour que ce parseur remplace celui par défaut. */
export function accepterLesCorpsJson(app: NestExpressApplication): void {
  app.useBodyParser('json', { limit: LIMITE_DU_CORPS_JSON });
}
