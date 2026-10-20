import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import type { EnvironmentProviders, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { PantryItem } from '@personal-os/contracts';
import { DccmConfirm, type DccmConfirmOptions } from '@personal-os/ui/dccm';
import { API_BASE_URL } from '../app/api-base-url';
import { INTERCEPTEURS } from '../app/app.config';
import { appRoutes } from '../app/app.routes';
import { BASE } from './catalogue';
import { fenetreDe } from './largeur';

/**
 * Ouvrir les écrans du Stock domestique depuis un test, par leur URL et leurs
 * vraies routes, devant une API simulée, dans une fenêtre de bureau sauf
 * mention contraire. La confirmation d'une suppression répond ce que le test
 * lui dit.
 */

export { BASE };

/** Le jour des tests : le stock compte ses péremptions depuis lui. */
export const MAINTENANT = new Date('2026-10-20T10:00:00+02:00');

export const LAIT: PantryItem = {
  id: 'ligne-1',
  ingredient: {
    id: 'ingredient-lait',
    displayName: 'Lait demi-écrémé',
    canonicalUnit: 'MILLILITER',
  },
  quantity: 1000,
  expiresOn: '2026-10-21',
  updatedAt: '2026-10-19T08:00:00.000Z',
};

export const SPAGHETTI: PantryItem = {
  id: 'ligne-2',
  ingredient: {
    id: 'ingredient-spaghetti',
    displayName: 'Spaghetti',
    canonicalUnit: 'GRAM',
  },
  quantity: 500,
  expiresOn: null,
  updatedAt: '2026-10-19T08:00:00.000Z',
};

export const YAOURT: PantryItem = {
  id: 'ligne-3',
  ingredient: {
    id: 'ingredient-yaourt',
    displayName: 'Yaourt nature',
    canonicalUnit: 'PIECE',
  },
  quantity: 4,
  expiresOn: '2026-11-02',
  updatedAt: '2026-10-19T08:00:00.000Z',
};

export async function ouvrirLeStock(
  url: string,
  {
    confirme = true,
    largeur = 1280,
  }: { confirme?: boolean; largeur?: number } = {},
) {
  // Les demandes de confirmation, dans l'ordre.
  const confirmations: DccmConfirmOptions[] = [];
  const confirm = (options: DccmConfirmOptions) => {
    confirmations.push(options);
    return Promise.resolve(confirme ? true : null);
  };
  const providers: (Provider | EnvironmentProviders)[] = [
    provideRouter(
      appRoutes.filter(({ path }) => path?.startsWith('repas/stock')),
    ),
    provideHttpClient(withInterceptors(INTERCEPTEURS)),
    provideHttpClientTesting(),
    { provide: API_BASE_URL, useValue: BASE },
    { provide: DccmConfirm, useValue: { confirm } },
    fenetreDe(largeur),
  ];
  TestBed.configureTestingModule({ providers });
  const harness = await RouterTestingHarness.create(url);
  const http = TestBed.inject(HttpTestingController);
  const el = () => harness.routeNativeElement as HTMLElement;

  return { harness, http, el, confirmations, router: TestBed.inject(Router) };
}
