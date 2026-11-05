import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { APP_BOOTSTRAP_LISTENER } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  Router,
  withDisabledInitialNavigation,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type {
  PublicPage,
  PublicProject,
  PublicProjectSummary,
} from '@personal-os/contracts';
import { API_BASE_URL } from '../app/api-base-url';
import { defilementDuRouteur } from '../app/app.config';
import { appRoutes } from '../app/app.routes';

/**
 * Ouvrir le portfolio depuis un test, par son URL et ses vraies routes,
 * devant une API simulée, un navigateur aux langues choisies et un
 * `localStorage` qui peut refuser de servir.
 */

export const BASE = 'http://api.test/api';

export interface Navigateur {
  /** `navigator.languages`, tiré de l'`Accept-Language` du navigateur. */
  langues?: readonly string[];
  /** Le choix mémorisé à l'ouverture. */
  memorise?: string;
  /** Un `localStorage` qui lève à chaque appel (navigation privée, quota). */
  stockageIndisponible?: boolean;
  /**
   * Le défilement du routeur de l'application (vers le fragment de l'URL).
   * Le routeur ne l'arme qu'au démarrage de l'application, que TestBed ne
   * joue pas : le harnais le déclenche lui-même.
   */
  defilement?: boolean;
}

export async function ouvrirLePortfolio(
  url: string,
  navigateur: Navigateur = {},
) {
  localStorage.clear();
  if (navigateur.memorise) {
    localStorage.setItem('portfolio.langue', navigateur.memorise);
  }
  jest
    .spyOn(navigator, 'languages', 'get')
    .mockReturnValue([...(navigateur.langues ?? ['fr-FR'])]);
  if (navigateur.stockageIndisponible) {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('refusé', 'SecurityError');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('refusé', 'QuotaExceededError');
    });
  }

  TestBed.configureTestingModule({
    providers: [
      navigateur.defilement
        ? // La navigation initiale reste celle du harnais, vers `url`.
          provideRouter(
            appRoutes,
            defilementDuRouteur,
            withDisabledInitialNavigation(),
          )
        : provideRouter(appRoutes),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: API_BASE_URL, useValue: BASE },
    ],
  });
  if (navigateur.defilement) {
    // TestBed n'amorce aucun composant racine : l'écouteur du routeur, qui
    // ne s'adresse qu'au premier, accepte donc `undefined`.
    for (const ecouteur of TestBed.inject(APP_BOOTSTRAP_LISTENER)) {
      ecouteur(undefined as never);
    }
  }
  const harness = await RouterTestingHarness.create(url);
  const http = TestBed.inject(HttpTestingController);

  return {
    harness,
    http,
    router: TestBed.inject(Router),
    el: () => harness.routeNativeElement?.ownerDocument.body ?? document.body,
  };
}

/** Une Page absente de cette langue : la réponse de l'API, telle quelle. */
export const PAGE_ABSENTE = [
  {
    status: 404,
    code: 'portfolio.public_page_not_found',
    message: 'Cette page n’est pas publiée dans cette langue.',
  },
  { status: 404, statusText: 'Not Found' },
] as const;

export const PROJET_ABSENT = [
  {
    status: 404,
    code: 'portfolio.public_project_not_found',
    message: 'Aucun projet publié de cet identifiant dans cette langue.',
  },
  { status: 404, statusText: 'Not Found' },
] as const;

export function page(
  slug: PublicPage['slug'],
  lang: PublicPage['lang'],
  title: string,
  body = '',
): PublicPage {
  return { slug, lang, title, body };
}

export const RELIURE_FR: PublicProject = {
  id: 'projet-1',
  lang: 'FR',
  title: 'Atelier de reliure',
  summary: 'Relier ses carnets à la main.',
  body: '## Étapes\n\nCoudre les cahiers.',
  publishedAt: '2026-10-12T08:00:00.000Z',
};

export function resume(projet: PublicProject): PublicProjectSummary {
  const { id, lang, title, summary, publishedAt } = projet;
  return { id, lang, title, summary, publishedAt };
}

/** Sert ce que l'accueil lit, page par page ; une page omise est absente. */
export function servirLAccueil(
  http: HttpTestingController,
  lang: 'FR' | 'EN',
  contenu: {
    about?: PublicPage;
    experience?: PublicPage;
    skills?: PublicPage;
    projets?: PublicProjectSummary[];
    cv?: boolean;
  },
): void {
  for (const slug of ['about', 'experience', 'skills'] as const) {
    const lue = contenu[slug];
    const requete = http.expectOne(`${BASE}/public/${lang}/pages/${slug}`);
    if (lue) {
      requete.flush(lue);
    } else {
      requete.flush(...PAGE_ABSENTE);
    }
  }
  http
    .expectOne(`${BASE}/public/${lang}/projects`)
    .flush(contenu.projets ?? []);
  const cv = http.expectOne(
    (requete) =>
      requete.method === 'HEAD' && requete.url === `${BASE}/public/cv/${lang}`,
  );
  if (contenu.cv) {
    cv.flush('');
  } else {
    cv.flush(null, { status: 404, statusText: 'Not Found' });
  }
}

/**
 * Un Projet lu, la page demande s'il est publié dans l'autre langue (un
 * `HEAD`, pour ses `hreflang`) : la demande est servie. La page n'est stable
 * qu'après, si bien que l'appel précède `whenStable()`.
 */
export async function servirLAutreLangue(
  http: HttpTestingController,
  lang: 'FR' | 'EN',
  id: string,
  publie: boolean,
): Promise<void> {
  // La réponse du Projet est traitée de façon asynchrone ; l'effet qui
  // demande l'autre langue passe ensuite.
  await new Promise((suite) => setTimeout(suite));
  TestBed.tick();
  const requete = http.expectOne(
    (demande) =>
      demande.method === 'HEAD' &&
      demande.url === `${BASE}/public/${lang}/projects/${id}`,
  );
  if (publie) {
    requete.flush('');
  } else {
    requete.flush(...PROJET_ABSENT);
  }
}
