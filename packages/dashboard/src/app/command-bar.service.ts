import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  CommandResolution,
  CommandResolveInput,
} from '@personal-os/contracts';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';

/**
 * Le transport de la barre de commande (ADR 0018) : la phrase part telle
 * qu'elle est écrite, l'API rend une action du catalogue (l'URL d'un écran
 * prérempli) ou dit qu'aucune ne correspond. Rien n'est enregistré.
 */
@Injectable({ providedIn: 'root' })
export class CommandBarService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  resoudre(text: string): Observable<CommandResolution> {
    const body: CommandResolveInput = { text };
    return this.http.post<CommandResolution>(
      `${this.baseUrl}/command-bar/resolve`,
      body,
    );
  }
}
