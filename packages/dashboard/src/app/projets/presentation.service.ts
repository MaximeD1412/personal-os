import {
  HttpClient,
  httpResource,
  type HttpResourceRef,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  Lang,
  PublicationTransition,
  PublicPresentation,
  PublicPresentationInput,
} from '@personal-os/contracts';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';

/** Les Présentations publiques d'un Projet, une par langue. */
@Injectable({ providedIn: 'root' })
export class PresentationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Les présentations rédigées du Projet ; le français d'abord. */
  presentations(
    projectId: () => string,
  ): HttpResourceRef<PublicPresentation[] | undefined> {
    return httpResource<PublicPresentation[]>(
      () => `${this.baseUrl}/projects/${projectId()}/presentations`,
    );
  }

  /** Crée la présentation de cette langue, ou en remplace le texte. */
  rediger(
    projectId: string,
    lang: Lang,
    saisie: PublicPresentationInput,
  ): Observable<PublicPresentation> {
    return this.http.put<PublicPresentation>(
      `${this.baseUrl}/projects/${projectId}/presentations/${lang}`,
      saisie,
    );
  }

  /** « Marquer prête », « Publier », « Dépublier » : `POST …/:lang/<verbe>`. */
  transition(
    projectId: string,
    lang: Lang,
    transition: PublicationTransition,
  ): Observable<PublicPresentation> {
    return this.http.post<PublicPresentation>(
      `${this.baseUrl}/projects/${projectId}/presentations/${lang}/${transition}`,
      {},
    );
  }
}
