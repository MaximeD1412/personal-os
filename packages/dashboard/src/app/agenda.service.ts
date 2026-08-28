import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { AgendaItem, AgendaPeriod } from '@personal-os/contracts';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';

@Injectable({ providedIn: 'root' })
export class AgendaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** L'Agenda se demande toujours borné : il n'existe pas de vue sans période. */
  lister(periode: AgendaPeriod): Observable<AgendaItem[]> {
    return this.http.get<AgendaItem[]>(`${this.baseUrl}/agenda`, {
      params: new HttpParams().set('from', periode.from).set('to', periode.to),
    });
  }
}
