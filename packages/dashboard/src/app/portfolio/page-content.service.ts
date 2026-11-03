import {
  HttpClient,
  httpResource,
  type HttpResourceRef,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  Lang,
  PageContent,
  PageContentInput,
  PageSlug,
  PublicationTransition,
} from '@personal-os/contracts';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';

/** Les Pages de contenu du portfolio, un texte par page et par langue. */
@Injectable({ providedIn: 'root' })
export class PageContentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Les textes rédigés, dans l'ordre du portfolio. */
  pages(): HttpResourceRef<PageContent[] | undefined> {
    return httpResource<PageContent[]>(() => `${this.baseUrl}/page-contents`);
  }

  /** Crée la page dans cette langue, ou en remplace le texte. */
  rediger(
    slug: PageSlug,
    lang: Lang,
    saisie: PageContentInput,
  ): Observable<PageContent> {
    return this.http.put<PageContent>(
      `${this.baseUrl}/page-contents/${slug}/${lang}`,
      saisie,
    );
  }

  /** « Marquer prête », « Publier », « Dépublier » : `POST …/:slug/:lang/<verbe>`. */
  transition(
    slug: PageSlug,
    lang: Lang,
    transition: PublicationTransition,
  ): Observable<PageContent> {
    return this.http.post<PageContent>(
      `${this.baseUrl}/page-contents/${slug}/${lang}/${transition}`,
      {},
    );
  }
}
