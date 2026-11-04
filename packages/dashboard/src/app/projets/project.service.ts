import {
  HttpClient,
  httpResource,
  type HttpResourceRef,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  Project,
  ProjectExpense,
  ProjectExpenseInput,
  ProjectInput,
  ProjectSummary,
  ProjectUpdate,
} from '@personal-os/contracts';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Les Projets de l'Espace personnel, du plus récemment modifié au plus ancien. */
  projets(): HttpResourceRef<ProjectSummary[]> {
    return httpResource<ProjectSummary[]>(() => `${this.baseUrl}/projects`, {
      defaultValue: [],
    });
  }

  /** Un Projet ; rien n'est lu tant que l'identifiant est vide. */
  projet(id: () => string | null): HttpResourceRef<Project | undefined> {
    return httpResource<Project>(() => {
      const actuel = id();
      return actuel ? `${this.baseUrl}/projects/${actuel}` : undefined;
    });
  }

  creer(saisie: ProjectInput): Observable<Project> {
    return this.http.post<Project>(`${this.baseUrl}/projects`, saisie);
  }

  modifier(id: string, changements: ProjectUpdate): Observable<Project> {
    return this.http.patch<Project>(
      `${this.baseUrl}/projects/${id}`,
      changements,
    );
  }

  supprimer(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/projects/${id}`);
  }

  ajouterUneDepense(
    id: string,
    saisie: ProjectExpenseInput,
  ): Observable<ProjectExpense> {
    return this.http.post<ProjectExpense>(
      `${this.baseUrl}/projects/${id}/expenses`,
      saisie,
    );
  }

  retirerUneDepense(id: string, expenseId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/projects/${id}/expenses/${expenseId}`,
    );
  }
}
