import { type CommandCatalog, zCommandCatalog } from '@personal-os/contracts';
import genere from '@personal-os/contracts/command-catalog.json';

/**
 * Le jeton du catalogue que la barre lit. En production, c'est celui que le
 * build a généré (`nx run api:command-catalog`) ; un test le remplace par le
 * sien, sans annoter de vrai endpoint.
 */
export const CATALOGUE_DE_COMMANDES = Symbol('CATALOGUE_DE_COMMANDES');

/** Le catalogue généré, relu par son schéma : un fichier altéré arrête l'API au démarrage. */
export function catalogueGenere(): CommandCatalog {
  return zCommandCatalog.parse(genere);
}
