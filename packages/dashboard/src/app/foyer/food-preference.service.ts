import {
  HttpClient,
  httpResource,
  type HttpResourceRef,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  FoodPreference,
  FoodPreferenceInput,
} from '@personal-os/contracts';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';

@Injectable({ providedIn: 'root' })
export class FoodPreferenceService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * Les Préférences alimentaires des deux Comptes du Foyer. À demander dans
   * un contexte d'injection : la lecture vit et s'arrête avec l'écran.
   */
  preferences(): HttpResourceRef<FoodPreference[]> {
    return httpResource<FoodPreference[]>(
      () => `${this.baseUrl}/food-preferences`,
      { defaultValue: [] },
    );
  }

  creer(saisie: FoodPreferenceInput): Observable<FoodPreference> {
    return this.http.post<FoodPreference>(
      `${this.baseUrl}/food-preferences`,
      saisie,
    );
  }

  supprimer(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/food-preferences/${id}`);
  }
}
