import { ApiExtension } from '@nestjs/swagger';
import type { CommandAnnotation } from '@personal-os/contracts';
import { EXTENSION_COMMANDE } from './catalogue/generer';

/**
 * Ouvre un endpoint à la barre de commande (ADR 0018) : il entre au catalogue
 * à la prochaine génération (`nx run api:command-catalog`). Un endpoint qui ne
 * le porte pas reste invisible pour la barre.
 *
 * - `intent` : la phrase qui dit quand l'employer, en français (« Créer un
 *   Événement ») ;
 * - `examples` : des commandes telles qu'on les tape ;
 * - `screen` : l'URL du formulaire du front (`/calendrier/evenements/nouveau`),
 *   qui se préremplit depuis ses paramètres de requête (ADR 0030) ;
 * - `params` : les champs du schéma d'entrée que la barre peut préremplir. Un
 *   champ que ce schéma n'a pas fait échouer la génération.
 */
export const Command = (annotation: CommandAnnotation): MethodDecorator =>
  ApiExtension(EXTENSION_COMMANDE, annotation);
