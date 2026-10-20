import {
  HttpClient,
  httpResource,
  type HttpResourceRef,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  Event,
  EventInput,
  EventListQuery,
  EventOccurrence,
  EventOccurrenceRef,
  EventOccurrenceUpdate,
  EventUpdate,
} from '@personal-os/contracts';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * Les Événements se demandent toujours bornés, et se lisent en occurrences :
   * celles qui rencontrent la période. La lecture suit la période qu'on lui
   * donne, et abandonne celle qu'une nouvelle période remplace.
   */
  lecture(periode: () => EventListQuery): HttpResourceRef<EventOccurrence[]> {
    return httpResource<EventOccurrence[]>(
      () => {
        const { from, to } = periode();
        return { url: `${this.baseUrl}/events`, params: { from, to } };
      },
      { defaultValue: [] },
    );
  }

  /**
   * Un Événement lui-même : pour une série, ses valeurs et sa règle, sans les
   * exceptions de ses occurrences. Rien n'est lu tant qu'aucun n'est visé.
   */
  evenement(id: () => string | null): HttpResourceRef<Event | undefined> {
    return httpResource<Event>(() => {
      const vise = id();
      return vise ? `${this.baseUrl}/events/${vise}` : undefined;
    });
  }

  creer(saisie: EventInput): Observable<Event> {
    return this.http.post<Event>(`${this.baseUrl}/events`, saisie);
  }

  modifier(id: string, changements: EventUpdate): Observable<Event> {
    return this.http.patch<Event>(`${this.baseUrl}/events/${id}`, changements);
  }

  supprimer(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/events/${id}`);
  }

  /** Une seule occurrence d'une série : la règle ne change pas. */
  modifierLOccurrence(
    { id, originalStart }: EventOccurrenceRef,
    changements: EventOccurrenceUpdate,
  ): Observable<EventOccurrence> {
    return this.http.patch<EventOccurrence>(
      `${this.baseUrl}/events/${id}/occurrences/${originalStart}`,
      changements,
    );
  }

  supprimerLOccurrence({
    id,
    originalStart,
  }: EventOccurrenceRef): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/events/${id}/occurrences/${originalStart}`,
    );
  }
}
