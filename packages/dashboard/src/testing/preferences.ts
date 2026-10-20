import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { FoodPreference, Household } from '@personal-os/contracts';
import { DccmConfirm, type DccmConfirmOptions } from '@personal-os/ui/dccm';
import { API_BASE_URL } from '../app/api-base-url';
import { INTERCEPTEURS } from '../app/app.config';
import { appRoutes } from '../app/app.routes';
import { BASE } from './catalogue';

/**
 * Ouvrir les écrans des Préférences alimentaires depuis un test, par leur URL
 * et leurs vraies routes, devant une API simulée. La confirmation d'une
 * suppression répond ce que le test lui dit.
 */

export { BASE };

export const FOYER: Household = {
  id: 'foyer',
  name: 'Le Foyer',
  members: [
    { id: 'compte-a', displayName: 'Maxime' },
    { id: 'compte-b', displayName: 'Léa' },
  ],
};

export const NOIX: FoodPreference = {
  id: 'preference-1',
  userId: 'compte-a',
  kind: 'ALLERGY',
  target: 'ALLERGEN',
  allergen: 'TREE_NUTS',
  createdAt: '2026-10-20T08:00:00.000Z',
};

export const CORIANDRE: FoodPreference = {
  id: 'preference-2',
  userId: 'compte-b',
  kind: 'DISLIKED',
  target: 'INGREDIENT',
  ingredientId: 'ingredient-3',
  ingredientDisplayName: 'Coriandre fraîche',
  createdAt: '2026-10-20T08:01:00.000Z',
};

export async function ouvrirLesPreferences(
  url: string,
  { confirme = true }: { confirme?: boolean } = {},
) {
  // Les demandes de confirmation, dans l'ordre.
  const confirmations: DccmConfirmOptions[] = [];
  const confirm = (options: DccmConfirmOptions) => {
    confirmations.push(options);
    return Promise.resolve(confirme ? true : null);
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter(
        appRoutes.filter(({ path }) => path?.startsWith('foyer/preferences')),
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
