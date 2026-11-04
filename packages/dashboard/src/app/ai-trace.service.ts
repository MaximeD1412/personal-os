import { httpResource, type HttpResourceRef } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { AiTrace } from '@personal-os/contracts';
import { API_BASE_URL } from './api-base-url';

/**
 * Le transport des Traces IA. Le journal est en ajout seul : on n'y lit
 * qu'une trace à la fois, pour comprendre une proposition.
 */
@Injectable({ providedIn: 'root' })
export class AiTraceService {
  private readonly baseUrl = inject(API_BASE_URL);

  /** Une trace complète ; rien n'est lu tant que l'identifiant est vide. */
  trace(id: () => string | null): HttpResourceRef<AiTrace | undefined> {
    return httpResource<AiTrace>(() => {
      const actuel = id();
      return actuel ? `${this.baseUrl}/ai-traces/${actuel}` : undefined;
    });
  }
}
