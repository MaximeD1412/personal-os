import { httpResource, type HttpResourceRef } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Household } from '@personal-os/contracts';
import { API_BASE_URL } from './api-base-url';

@Injectable({ providedIn: 'root' })
export class HouseholdService {
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * Le Foyer du Compte connecté et ses deux Comptes, pour choisir des
   * Participants. À demander dans un contexte d'injection : la lecture vit et
   * s'arrête avec l'écran qui la porte.
   */
  foyer(): HttpResourceRef<Household | undefined> {
    return httpResource<Household>(() => `${this.baseUrl}/household`);
  }
}
