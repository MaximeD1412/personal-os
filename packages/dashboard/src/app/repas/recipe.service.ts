import {
  HttpClient,
  httpResource,
  type HttpResourceRef,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Recipe } from '@personal-os/contracts';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';

/**
 * Le transport des Recettes. La saisie d'une recette vient avec son
 * formulaire (CUISINE-6) ; on ne fait ici que lire, et garder une recette
 * générée.
 */
@Injectable({ providedIn: 'root' })
export class RecipeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * Les recettes gardées du Foyer, filtrées par la recherche qu'on leur donne (toutes
   * sans recherche). La lecture suit la recherche, et abandonne celle qu'une
   * nouvelle frappe remplace. Rien n'est lu tant que la recherche vaut `null`.
   */
  recettes(recherche: () => string | null): HttpResourceRef<Recipe[]> {
    return httpResource<Recipe[]>(
      () => {
        const saisie = recherche();
        if (saisie === null) return undefined;
        const q = saisie.trim();
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

  /** Garder une recette générée : elle rejoint « Mes recettes ». */
  garder(id: string): Observable<Recipe> {
    return this.http.post<Recipe>(`${this.baseUrl}/recipes/${id}/keep`, {});
  }
}
