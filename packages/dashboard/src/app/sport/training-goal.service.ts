import {
  HttpClient,
  httpResource,
  type HttpResourceRef,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  TrainingGoal,
  TrainingGoalInput,
  TrainingGoalUpdate,
  TrainingSeriesInput,
  TrainingSession,
} from '@personal-os/contracts';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';

/** Le transport des Objectifs, typé par `contracts`, sans règle métier (ADR 0030). */
@Injectable({ providedIn: 'root' })
export class TrainingGoalService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Tous les Objectifs du Compte, du plus proche au plus lointain. */
  lecture(): HttpResourceRef<TrainingGoal[]> {
    return httpResource<TrainingGoal[]>(
      () => `${this.baseUrl}/training-goals`,
      { defaultValue: [] },
    );
  }

  /** Un Objectif, relu quand l'identifiant change ; rien tant qu'il manque. */
  lectureDe(id: () => string): HttpResourceRef<TrainingGoal | undefined> {
    return httpResource<TrainingGoal>(() =>
      id() ? `${this.baseUrl}/training-goals/${id()}` : undefined,
    );
  }

  /** Les Séances liées à un Objectif, de la plus ancienne à la plus lointaine. */
  lectureDesSeances(id: () => string): HttpResourceRef<TrainingSession[]> {
    return httpResource<TrainingSession[]>(
      () =>
        id() ? `${this.baseUrl}/training-goals/${id()}/sessions` : undefined,
      { defaultValue: [] },
    );
  }

  creer(saisie: TrainingGoalInput): Observable<TrainingGoal> {
    return this.http.post<TrainingGoal>(
      `${this.baseUrl}/training-goals`,
      saisie,
    );
  }

  modifier(
    id: string,
    changements: TrainingGoalUpdate,
  ): Observable<TrainingGoal> {
    return this.http.patch<TrainingGoal>(
      `${this.baseUrl}/training-goals/${id}`,
      changements,
    );
  }

  supprimer(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/training-goals/${id}`);
  }

  /** Crée les Séances prévues de la série, toutes liées à l'Objectif. */
  creerLaSerie(
    id: string,
    serie: TrainingSeriesInput,
  ): Observable<TrainingSession[]> {
    return this.http.post<TrainingSession[]>(
      `${this.baseUrl}/training-goals/${id}/sessions`,
      serie,
    );
  }
}
