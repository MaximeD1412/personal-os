import { httpResource, type HttpResourceRef } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { AgendaItem, AgendaPeriod } from '@personal-os/contracts';
import { API_BASE_URL } from './api-base-url';

@Injectable({ providedIn: 'root' })
export class AgendaService {
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * L'Agenda se demande toujours borné : il n'existe pas de vue sans période.
   * La lecture suit la période qu'on lui donne.
   */
  lecture(periode: () => AgendaPeriod): HttpResourceRef<AgendaItem[]> {
    return httpResource<AgendaItem[]>(
      () => {
        const { from, to } = periode();
        return { url: `${this.baseUrl}/agenda`, params: { from, to } };
      },
      { defaultValue: [] },
    );
  }
}
