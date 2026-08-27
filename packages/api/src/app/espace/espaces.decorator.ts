import { SetMetadata } from '@nestjs/common';
import type { TypeEspace } from '@personal-os/database';

export const ESPACES_ACCEPTES = 'personal-os:espaces-acceptes';

/**
 * Déclare les Espaces qu'un module accepte — les repas sont toujours dans
 * l'Espace foyer, les finances toujours dans un Espace personnel, le
 * calendrier accepte les deux (ADR 0014).
 *
 * Un module qui touche à des données cloisonnées **sans** porter ce décorateur
 * n'a aucune portée : ses requêtes échouent bruyamment, plutôt que de rendre
 * une liste vide qui ressemblerait à une réponse.
 */
export const Espaces = (...types: TypeEspace[]) =>
  SetMetadata(ESPACES_ACCEPTES, types);
