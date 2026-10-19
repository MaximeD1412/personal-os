import { HttpStatus } from '@nestjs/common';
import type { ZodType } from 'zod';
import { ErreurMetier } from '../erreurs/erreur-metier';

/** Un appel au fournisseur : la demande telle que le port l'a reçue. */
export interface AppelIA {
  but: string;
  systeme: string;
  message: string;
  schema: ZodType;
  maxTokens: number;
}

/** Ce que le fournisseur a rendu, sans aucune validation. */
export interface ReponseIA {
  /** Le modèle qui a répondu, tel que le fournisseur le nomme. */
  modele: string;
  /** Le texte brut de la réponse, qui devrait être un JSON conforme au schéma. */
  texte: string;
  jetonsEntree: number;
  jetonsSortie: number;
}

/**
 * L'adaptateur d'un fournisseur d'IA : il porte l'appel et rien d'autre. La
 * trace, le plafond de coût, la validation et la nouvelle tentative sont
 * communs à tous les fournisseurs, et vivent derrière le port
 * (`GenerateurIAService`) : changer de fournisseur ne peut pas les perdre.
 */
export abstract class FournisseurIA {
  /** Le modèle appelé, nommé dans la trace d'un appel qui n'a pas répondu. */
  abstract readonly modele: string;

  abstract appeler(appel: AppelIA): Promise<ReponseIA>;
}

/**
 * Le fournisseur n'a pas répondu : panne réseau, surcharge, clé refusée. Le
 * message affiché reste général ; `detail` dit ce qui s'est passé, et c'est lui
 * que garde la trace de l'appel.
 */
export class PanneDuFournisseur extends ErreurMetier {
  constructor(readonly detail: string) {
    super(
      'ai.provider_unavailable',
      "Le service d'IA ne répond pas. Réessaie dans un instant.",
      HttpStatus.BAD_GATEWAY,
    );
  }
}
