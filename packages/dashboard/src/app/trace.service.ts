import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Trace, TraceInput } from '@personal-os/contracts';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';

@Injectable({ providedIn: 'root' })
export class TraceService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  lister(): Observable<Trace[]> {
    return this.http.get<Trace[]>(`${this.baseUrl}/traces`);
  }

  creer(saisie: TraceInput): Observable<Trace> {
    return this.http.post<Trace>(`${this.baseUrl}/traces`, saisie);
  }

  supprimer(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/traces/${id}`);
  }
}
