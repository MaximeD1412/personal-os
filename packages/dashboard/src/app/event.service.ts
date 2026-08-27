import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Event, EventInput, EventUpdate } from '@personal-os/contracts';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  lister(): Observable<Event[]> {
    return this.http.get<Event[]>(`${this.baseUrl}/events`);
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
}
