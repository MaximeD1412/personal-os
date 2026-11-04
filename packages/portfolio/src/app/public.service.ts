import { httpResource, type HttpResourceRef } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  Lang,
  PageSlug,
  PublicPage,
  PublicProject,
  PublicProjectSummary,
} from '@personal-os/contracts';
import { API_BASE_URL } from './api-base-url';

/**
 * Le transport du portfolio public : les routes `/public/…` de l'API, sans
 * session. Elles ne servent que le publié, dans la langue demandée.
 */
@Injectable({ providedIn: 'root' })
export class PublicService {
  private readonly baseUrl = inject(API_BASE_URL);

  page(
    lang: () => Lang,
    slug: PageSlug,
  ): HttpResourceRef<PublicPage | undefined> {
    return httpResource<PublicPage>(
      () => `${this.baseUrl}/public/${lang()}/pages/${slug}`,
    );
  }

  projets(
    lang: () => Lang,
  ): HttpResourceRef<PublicProjectSummary[] | undefined> {
    return httpResource<PublicProjectSummary[]>(
      () => `${this.baseUrl}/public/${lang()}/projects`,
    );
  }

  projet(
    lang: () => Lang,
    id: () => string,
  ): HttpResourceRef<PublicProject | undefined> {
    return httpResource<PublicProject>(
      () => `${this.baseUrl}/public/${lang()}/projects/${id()}`,
    );
  }

  /**
   * Si un Projet est publié dans une langue : un `HEAD`, sans en lire le
   * texte. Rien n'est demandé tant que `id` rend `undefined`.
   */
  projetPublie(
    lang: () => Lang,
    id: () => string | undefined,
  ): HttpResourceRef<string | undefined> {
    return httpResource.text(() => {
      const projet = id();
      return projet === undefined
        ? undefined
        : {
            url: `${this.baseUrl}/public/${lang()}/projects/${projet}`,
            method: 'HEAD',
          };
    });
  }

  /** Le PDF de cette langue, ouvert par un simple lien. */
  urlDuCv(lang: Lang): string {
    return `${this.baseUrl}/public/cv/${lang}`;
  }

  /** Si un CV existe dans cette langue : un `HEAD`, sans en lire le PDF. */
  cv(lang: () => Lang): HttpResourceRef<string | undefined> {
    return httpResource.text(() => ({
      url: this.urlDuCv(lang()),
      method: 'HEAD',
    }));
  }
}
