import type { ZodType } from 'zod';

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
  abstract appeler(appel: AppelIA): Promise<ReponseIA>;
}
