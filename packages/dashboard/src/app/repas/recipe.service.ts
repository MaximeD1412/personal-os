import { httpResource, type HttpResourceRef } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Recipe } from '@personal-os/contracts';
import { API_BASE_URL } from '../api-base-url';

/**
 * Le transport des Recettes. Il ne fait que lire : la saisie d'une recette
 * vient avec son formulaire (CUISINE-6).
 */
@Injectable({ providedIn: 'root' })
export class RecipeService {
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * Les recettes du Foyer, filtrées par la recherche qu'on leur donne (toutes
   * sans recherche). La lecture suit la recherche, et abandonne celle qu'une
   * nouvelle frappe remplace.
   */
  recettes(recherche: () => string): HttpResourceRef<Recipe[]> {
    return httpResource<Recipe[]>(
      () => {
        const q = recherche().trim();
        const params: Record<string, string> = q ? { q } : {};
        return { url: `${this.baseUrl}/recipes`, params };
      },
      { defaultValue: [] },
    );
  }

  /** Une recette ; rien n'est lu tant que l'identifiant est vide. */
  recette(id: () => string | null): HttpResourceRef<Recipe | undefined> {
    return httpResource<Recipe>(() => {
      const actuelle = id();
      return actuelle ? `${this.baseUrl}/recipes/${actuelle}` : undefined;
    });
  }
}
