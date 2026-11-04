import { httpResource, type HttpResourceRef } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { ModuleSummary, Todo } from '@personal-os/contracts';
import { API_BASE_URL } from './api-base-url';

/**
 * Le tableau de bord de l'API : il ne fait que lire. Un À faire ne se coche
 * pas, il disparaît quand sa situation change (ADR 0017).
 */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly baseUrl = inject(API_BASE_URL);

  /** Les À faire, l'échéance la plus proche d'abord. */
  aFaire(): HttpResourceRef<Todo[]> {
    return httpResource<Todo[]>(() => `${this.baseUrl}/dashboard/todos`, {
      defaultValue: [],
    });
  }

  /** Les Résumés de module, dans l'ordre où l'API les rend. */
  resumes(): HttpResourceRef<ModuleSummary[]> {
    return httpResource<ModuleSummary[]>(
      () => `${this.baseUrl}/dashboard/summaries`,
      { defaultValue: [] },
    );
  }
}
