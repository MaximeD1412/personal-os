import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { CookedMeal, CookedMealInput } from '@personal-os/contracts';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';

/**
 * Le transport des Repas cuisinés. Ils ne font que se déclarer : un Repas
 * cuisiné ne se modifie pas, une erreur se corrige dans l'écran de stock.
 */
@Injectable({ providedIn: 'root' })
export class CookedMealService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** La réponse dit aussi ce que le stock n'avait pas (`shortfalls`). */
  declarer(saisie: CookedMealInput): Observable<CookedMeal> {
    return this.http.post<CookedMeal>(`${this.baseUrl}/cooked-meals`, saisie);
  }
}
