import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { PageContent } from '@personal-os/contracts';
import { DccmConfirm, type DccmConfirmOptions } from '@personal-os/ui/dccm';
import { API_BASE_URL } from '../app/api-base-url';
import { INTERCEPTEURS } from '../app/app.config';
import { appRoutes } from '../app/app.routes';

/**
 * Ouvrir les écrans du portfolio depuis un test, par leur URL et leurs vraies
 * routes, devant une API simulée. La confirmation répond ce qu'on lui dit.
 */

export const BASE = 'http://api.test/api';

/** La présentation, en français, en ligne. */
export const PRESENTATION_EN_LIGNE: PageContent = {
  id: 'page-about-fr',
  slug: 'about',
  lang: 'FR',
  title: 'Qui je suis',
  body: '## Parcours\n\nDu papier au code, *à la main*.',
  publicationState: 'PUBLISHED',
  updatedAt: '2026-10-14T08:00:00.000Z',
};

/** Les écrans du portfolio, avec leurs vraies routes. */
export async function ouvrirLePortfolio(
  url: string,
  { confirme = true }: { confirme?: boolean } = {},
) {
  // Les confirmations demandées, dans l'ordre ; chacune reçoit la réponse dite.
  const confirmations: DccmConfirmOptions[] = [];
  const confirm = async (options: DccmConfirmOptions) => {
    confirmations.push(options);
    return confirme ? (true as const) : null;
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter(
        appRoutes.filter(({ path }) => path?.startsWith('portfolio')),
      ),
      provideHttpClient(withInterceptors(INTERCEPTEURS)),
      provideHttpClientTesting(),
      { provide: API_BASE_URL, useValue: BASE },
      { provide: DccmConfirm, useValue: { confirm } },
    ],
  });
  const harness = await RouterTestingHarness.create(url);
  const http = TestBed.inject(HttpTestingController);
  const el = () => harness.routeNativeElement as HTMLElement;

  return { harness, http, el, confirmations };
}
