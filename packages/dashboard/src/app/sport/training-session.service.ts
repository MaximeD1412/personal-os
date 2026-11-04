import {
  HttpClient,
  httpResource,
  type HttpResourceRef,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  TrainingSession,
  TrainingSessionCompletion,
  TrainingSessionInput,
  TrainingSessionListQuery,
  TrainingSessionUpdate,
} from '@personal-os/contracts';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';

/** Le transport des Séances, typé par `contracts`, sans règle métier (ADR 0030). */
@Injectable({ providedIn: 'root' })
export class TrainingSessionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Les Séances de la période, relues quand la période change. */
  lecture(
    periode: () => TrainingSessionListQuery,
  ): HttpResourceRef<TrainingSession[]> {
    return httpResource<TrainingSession[]>(
      () => {
        const { from, to } = periode();
        return {
          url: `${this.baseUrl}/training-sessions`,
          params: { from, to },
        };
      },
      { defaultValue: [] },
    );
  }

  /** Une Séance, relue quand l'identifiant change ; rien tant qu'il manque. */
  lectureDe(id: () => string): HttpResourceRef<TrainingSession | undefined> {
    return httpResource<TrainingSession>(() =>
      id() ? `${this.baseUrl}/training-sessions/${id()}` : undefined,
    );
  }

  creer(saisie: TrainingSessionInput): Observable<TrainingSession> {
    return this.http.post<TrainingSession>(
      `${this.baseUrl}/training-sessions`,
      saisie,
    );
  }

  modifier(
    id: string,
    changements: TrainingSessionUpdate,
  ): Observable<TrainingSession> {
    return this.http.patch<TrainingSession>(
      `${this.baseUrl}/training-sessions/${id}`,
      changements,
    );
  }

  completer(
    id: string,
    realise: TrainingSessionCompletion,
  ): Observable<TrainingSession> {
    return this.http.post<TrainingSession>(
      `${this.baseUrl}/training-sessions/${id}/complete`,
      realise,
    );
  }

  manquer(id: string): Observable<TrainingSession> {
    return this.http.post<TrainingSession>(
      `${this.baseUrl}/training-sessions/${id}/miss`,
      {},
    );
  }
}
