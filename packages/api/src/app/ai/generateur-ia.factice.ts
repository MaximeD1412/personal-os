import { Injectable } from '@nestjs/common';
import { FournisseurIA, type AppelIA, type ReponseIA } from './fournisseur-ia';

type Jetons = Pick<ReponseIA, 'jetonsEntree' | 'jetonsSortie'>;

/**
 * Le double de test du fournisseur : il rend ce qu'on lui a programmé pour un
 * `but`, sans aucun réseau.
 */
@Injectable()
export class GenerateurIAFactice extends FournisseurIA {
  readonly modele = 'factice';
  readonly #reponses = new Map<string, (ReponseIA | Error)[]>();

  /**
   * Programme la prochaine réponse à ce but : une valeur, rendue en JSON. Les
   * jetons, nuls par défaut, servent à éprouver le plafond de coût.
   */
  programmer(but: string, valeur: unknown, jetons: Partial<Jetons> = {}): void {
    this.#file(but).push({
      modele: this.modele,
      texte: JSON.stringify(valeur),
      jetonsEntree: jetons.jetonsEntree ?? 0,
      jetonsSortie: jetons.jetonsSortie ?? 0,
    });
  }

  /** Programme une réponse brute, pour simuler une sortie mal formée. */
  programmerTexte(but: string, texte: string): void {
    this.#file(but).push({
      modele: this.modele,
      texte,
      jetonsEntree: 0,
      jetonsSortie: 0,
    });
  }

  /** Programme une panne : l'appel lève cette erreur au lieu de répondre. */
  programmerPanne(but: string, erreur: Error): void {
    this.#file(but).push(erreur);
  }

  async appeler(appel: AppelIA): Promise<ReponseIA> {
    const reponse = this.#file(appel.but).shift();
    if (!reponse) {
      throw new Error(`Aucune réponse programmée pour « ${appel.but} ».`);
    }
    if (reponse instanceof Error) {
      throw reponse;
    }
    return reponse;
  }

  #file(but: string): (ReponseIA | Error)[] {
    const file = this.#reponses.get(but) ?? [];
    this.#reponses.set(but, file);
    return file;
  }
}
