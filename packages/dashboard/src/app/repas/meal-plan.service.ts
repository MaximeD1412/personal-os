import {
  HttpClient,
  httpResource,
  type HttpResourceRef,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  GenerationRound,
  GenerationRoundInput,
  MealPlan,
  MealPlanEntry,
  MealPlanEntryDecisionInput,
  MealPlanEntryInput,
} from '@personal-os/contracts';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';

@Injectable({ providedIn: 'root' })
export class MealPlanService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * Le Planning de repas d'une semaine, par son lundi : l'API le crée vide
   * s'il n'existe pas encore. La lecture suit la semaine. À demander dans un
   * contexte d'injection : elle vit et s'arrête avec l'écran.
   */
  planning(semaine: () => string): HttpResourceRef<MealPlan | undefined> {
    return httpResource<MealPlan>(() => ({
      url: `${this.baseUrl}/meal-plans`,
      params: { week: semaine() },
    }));
  }

  /** Un Repas planifié lu seul ; rien n'est lu tant que l'identifiant est vide. */
  repas(id: () => string | null): HttpResourceRef<MealPlanEntry | undefined> {
    return httpResource<MealPlanEntry>(() => {
      const actuel = id();
      return actuel ? `${this.baseUrl}/meal-plan-entries/${actuel}` : undefined;
    });
  }

  ajouter(
    planId: string,
    saisie: MealPlanEntryInput,
  ): Observable<MealPlanEntry> {
    return this.http.post<MealPlanEntry>(
      `${this.baseUrl}/meal-plans/${planId}/entries`,
      saisie,
    );
  }

  arreter(planId: string): Observable<MealPlan> {
    return this.http.post<MealPlan>(
      `${this.baseUrl}/meal-plans/${planId}/stop`,
      {},
    );
  }

  rouvrir(planId: string): Observable<MealPlan> {
    return this.http.post<MealPlan>(
      `${this.baseUrl}/meal-plans/${planId}/reopen`,
      {},
    );
  }

  /**
   * Un Tour de génération : l'IA propose, le contrôle écarte. Seul le premier
   * tour lit ses créneaux ; les suivants régénèrent les refusés et les écartés.
   */
  lancerUnTour(
    planId: string,
    saisie: GenerationRoundInput,
  ): Observable<GenerationRound> {
    return this.http.post<GenerationRound>(
      `${this.baseUrl}/meal-plans/${planId}/generation-rounds`,
      saisie,
    );
  }

  /** On statue sur un repas proposé : approuvé, ou refusé. */
  decider(
    planId: string,
    repasId: string,
    decision: MealPlanEntryDecisionInput['decision'],
  ): Observable<MealPlanEntry> {
    return this.http.post<MealPlanEntry>(
      `${this.baseUrl}/meal-plans/${planId}/entries/${repasId}/decision`,
      { decision },
    );
  }
}
