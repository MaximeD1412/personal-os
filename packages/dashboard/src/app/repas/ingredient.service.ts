import {
  HttpClient,
  httpResource,
  type HttpResourceRef,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  Ingredient,
  IngredientInput,
  IngredientUpdate,
} from '@personal-os/contracts';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';

@Injectable({ providedIn: 'root' })
export class IngredientService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * Le catalogue, filtré par la recherche qu'on lui donne (tout le catalogue
   * sans recherche). La lecture suit la recherche, et abandonne celle qu'une
   * nouvelle frappe remplace. Rien n'est lu tant que `active` est faux (un
   * formulaire où l'on ne cherche pas encore d'Ingrédient).
   */
  catalogue(
    recherche: () => string,
    active: () => boolean = () => true,
  ): HttpResourceRef<Ingredient[]> {
    return httpResource<Ingredient[]>(
      () => {
        if (!active()) return undefined;
        const q = recherche().trim();
        const params: Record<string, string> = q ? { q } : {};
        return { url: `${this.baseUrl}/ingredients`, params };
      },
      { defaultValue: [] },
    );
  }

  /** Un Ingrédient ; rien n'est lu tant que l'identifiant est vide. */
  ingredient(id: () => string | null): HttpResourceRef<Ingredient | undefined> {
    return httpResource<Ingredient>(() => {
      const actuel = id();
      return actuel ? `${this.baseUrl}/ingredients/${actuel}` : undefined;
    });
  }

  creer(saisie: IngredientInput): Observable<Ingredient> {
    return this.http.post<Ingredient>(`${this.baseUrl}/ingredients`, saisie);
  }

  modifier(id: string, changements: IngredientUpdate): Observable<Ingredient> {
    return this.http.patch<Ingredient>(
      `${this.baseUrl}/ingredients/${id}`,
      changements,
    );
  }
}
