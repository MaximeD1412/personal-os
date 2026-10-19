import { Injectable } from '@nestjs/common';
import { FournisseurIA, type AppelIA, type ReponseIA } from './fournisseur-ia';

type Jetons = Pick<ReponseIA, 'jetonsEntree' | 'jetonsSortie'>;

/**
 * Le double de test du fournisseur : il rend ce qu'on lui a programmé pour un
 * `but`, sans aucun réseau.
 */
@Injectable()
export class GenerateurIAFactice extends FournisseurIA {
  readonly #reponses = new Map<string, ReponseIA[]>();

  /**
   * Programme la prochaine réponse à ce but : une valeur, rendue en JSON. Les
   * jetons, nuls par défaut, servent à éprouver le plafond de coût.
   */
  programmer(but: string, valeur: unknown, jetons: Partial<Jetons> = {}): void {
    this.#file(but).push({
      modele: 'factice',
      texte: JSON.stringify(valeur),
      jetonsEntree: jetons.jetonsEntree ?? 0,
      jetonsSortie: jetons.jetonsSortie ?? 0,
    });
  }

  /** Programme une réponse brute, pour simuler une sortie mal formée. */
  programmerTexte(but: string, texte: string): void {
    this.#file(but).push({
      modele: 'factice',
      texte,
      jetonsEntree: 0,
      jetonsSortie: 0,
    });
  }

  appeler(appel: AppelIA): Promise<ReponseIA> {
    const reponse = this.#file(appel.but).shift();
    if (!reponse) {
      throw new Error(`Aucune réponse programmée pour « ${appel.but} ».`);
    }
    return Promise.resolve(reponse);
  }

  #file(but: string): ReponseIA[] {
    const file = this.#reponses.get(but) ?? [];
    this.#reponses.set(but, file);
    return file;
  }
}
