import {
  HttpClient,
  httpResource,
  type HttpResourceRef,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { PantryItem, PantryItemInput } from '@personal-os/contracts';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';

@Injectable({ providedIn: 'root' })
export class PantryItemService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * Tout le Stock domestique, par ordre alphabétique d'Ingrédient. À demander
   * dans un contexte d'injection : la lecture vit et s'arrête avec l'écran.
   */
  stock(): HttpResourceRef<PantryItem[]> {
    return httpResource<PantryItem[]>(() => `${this.baseUrl}/pantry-items`, {
      defaultValue: [],
    });
  }

  /** La correction manuelle : remplace la ligne de l'Ingrédient, ou la crée. */
  corriger(
    ingredientId: string,
    saisie: PantryItemInput,
  ): Observable<PantryItem> {
    return this.http.put<PantryItem>(
      `${this.baseUrl}/pantry-items/${ingredientId}`,
      saisie,
    );
  }

  supprimer(ingredientId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/pantry-items/${ingredientId}`,
    );
  }
}
