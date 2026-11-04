import {
  HttpClient,
  httpResource,
  type HttpResourceRef,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { MealWish, MealWishInput } from '@personal-os/contracts';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';

@Injectable({ providedIn: 'root' })
export class MealWishService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * Les Souhaits d'une semaine, par son lundi. La lecture suit la semaine. À
   * demander dans un contexte d'injection : elle vit et s'arrête avec l'écran.
   */
  souhaits(semaine: () => string): HttpResourceRef<MealWish[]> {
    return httpResource<MealWish[]>(
      () => ({
        url: `${this.baseUrl}/meal-wishes`,
        params: { week: semaine() },
      }),
      { defaultValue: [] },
    );
  }

  deposer(saisie: MealWishInput): Observable<MealWish> {
    return this.http.post<MealWish>(`${this.baseUrl}/meal-wishes`, saisie);
  }

  retirer(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/meal-wishes/${id}`);
  }
}
