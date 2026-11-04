import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { Ingredient } from '@personal-os/contracts';
import { DccmConfirm, type DccmConfirmOptions } from '@personal-os/ui/dccm';
import { API_BASE_URL } from '../app/api-base-url';
import { INTERCEPTEURS } from '../app/app.config';
import { appRoutes } from '../app/app.routes';

/**
 * Ouvrir les écrans du catalogue d'Ingrédients depuis un test, par leur URL et
 * leurs vraies routes, devant une API simulée.
 */

export const BASE = 'http://api.test/api';

export const BEURRE: Ingredient = {
  id: 'ingredient-1',
  name: 'beurre doux',
  displayName: 'Beurre doux',
  canonicalUnit: 'GRAM',
  gramsPerPiece: null,
  allergens: ['MILK'],
  perishable: true,
  preferredProductId: null,
  createdAt: '2026-10-19T08:00:00.000Z',
};

export const OIGNON: Ingredient = {
  id: 'ingredient-2',
  name: 'oignon jaune',
  displayName: 'Oignon jaune',
  canonicalUnit: 'PIECE',
  gramsPerPiece: 150,
  allergens: [],
  perishable: false,
  preferredProductId: null,
  createdAt: '2026-10-19T08:00:00.000Z',
};

/**
 * Les écrans du catalogue, avec leurs vraies routes. La confirmation d'un
 * retrait répond ce que le test lui dit.
 */
export async function ouvrirLeCatalogue(
  url: string,
  { confirme = true }: { confirme?: boolean } = {},
) {
  // Les demandes de confirmation, dans l'ordre.
  const confirmations: DccmConfirmOptions[] = [];
  const confirm = async (options: DccmConfirmOptions) => {
    confirmations.push(options);
    return confirme ? true : null;
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter(
        appRoutes.filter(({ path }) => path?.startsWith('repas/ingredients')),
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

  return { harness, http, el, confirmations, router: TestBed.inject(Router) };
}
