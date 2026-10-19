import type { ZodType } from 'zod';

/** Ce qu'un module demande au modèle : une donnée de la forme de `schema`. */
export interface DemandeStructuree<T> {
  /**
   * Le but de l'appel, en anglais et sous la forme `<module>.<cas>`
   * (`meal-plan.generate`). Il nomme la trace, et c'est sur lui que le double
   * de test programme ses réponses.
   */
  but: string;
  /** La consigne, qui ne varie pas d'un appel à l'autre. */
  systeme: string;
  /** La demande elle-même. */
  message: string;
  /** La forme attendue : la réponse n'est rendue que si elle la respecte. */
  schema: ZodType<T>;
  /** Le plafond de jetons de la réponse. */
  maxTokens: number;
}

/** Une réponse validée, et la trace de l'appel qui l'a produite. */
export interface Structure<T> {
  valeur: T;
  traceId: string;
}

/**
 * Le port IA : la seule porte par laquelle un module de l'application parle à
 * un modèle (génération du planning, résolution d'intention). Le fournisseur
 * est un détail remplaçable, choisi par `AI_PROVIDER`.
 *
 * Le modèle produit des données, l'application décide : aucun outil ne lui est
 * jamais donné, et ce qu'il rend n'arrive au module qu'après validation par le
 * schéma (risque SEC-6).
 *
 * Une classe abstraite plutôt qu'une interface : elle sert de jeton
 * d'injection, et un module la reçoit sans savoir qui l'implémente.
 */
export abstract class GenerateurIA {
  abstract genererStructure<T>(
    demande: DemandeStructuree<T>,
  ): Promise<Structure<T>>;
}
