import { Injectable } from '@angular/core';
import type { RecipeUnit } from '@personal-os/contracts';

/** Le paramètre du retour depuis la création d'un Ingrédient : reprendre la saisie. */
export const PARAMETRE_DE_BROUILLON = 'brouillon';
/** L'Ingrédient créé, au retour, pour la ligne qui l'attendait. */
export const PARAMETRE_D_INGREDIENT = 'ingredient';

/** Ce qu'on sait de l'Ingrédient d'une ligne. */
export type Rattachement =
  /** Le libellé n'a pas encore été soumis au résolveur. */
  | { etat: 'a-resoudre' }
  | { etat: 'reconnu'; ingredientId: string }
  | { etat: 'inconnu'; suggestions: readonly string[] };

/** Une ligne d'ingrédient telle qu'on la saisit : trois champs, et son Ingrédient. */
export interface LigneSaisie {
  /** Son identité dans le formulaire, le temps de la saisie. */
  cle: number;
  quantite: number | null;
  unite: RecipeUnit | null;
  libelle: string;
  rattachement: Rattachement;
  /** Le refus d'un rattachement, que l'API motive. */
  refus: string | null;
}

export interface EtapeSaisie {
  cle: number;
  texte: string;
}

/** Une saisie de recette en cours, mise de côté le temps de créer un Ingrédient. */
export interface BrouillonDeRecette {
  titre: string;
  portions: number | null;
  etapes: readonly EtapeSaisie[];
  lignes: readonly LigneSaisie[];
  /** La ligne dont on crée l'Ingrédient : elle le reçoit au retour. */
  enAttente: number;
}

/**
 * La saisie d'une recette survit à la création d'un Ingrédient : le
 * formulaire la met de côté avant d'ouvrir celui de l'Ingrédient, et la
 * reprend au retour. Elle vit en mémoire, le temps de l'aller-retour, sous le
 * chemin du formulaire qui l'a laissée.
 */
@Injectable({ providedIn: 'root' })
export class BrouillonsDeRecette {
  private readonly brouillons = new Map<string, BrouillonDeRecette>();

  garder(chemin: string, brouillon: BrouillonDeRecette): void {
    this.brouillons.set(chemin, brouillon);
  }

  /** Le brouillon laissé sous ce chemin, une seule fois. */
  reprendre(chemin: string): BrouillonDeRecette | null {
    const brouillon = this.brouillons.get(chemin) ?? null;
    this.brouillons.delete(chemin);
    return brouillon;
  }
}
