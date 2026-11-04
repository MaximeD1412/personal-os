import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { ShoppingList, ShoppingListItem } from '@personal-os/contracts';
import { DccmConfirm, type DccmConfirmOptions } from '@personal-os/ui/dccm';
import { API_BASE_URL } from '../app/api-base-url';
import { INTERCEPTEURS } from '../app/app.config';
import { appRoutes } from '../app/app.routes';
import { BASE } from './catalogue';

/**
 * Ouvrir les écrans de la Liste de courses depuis un test, par leur URL et
 * leurs vraies routes, devant une API simulée. La confirmation d'un retrait
 * répond ce que le test lui dit.
 */

export { BASE };

export const FARINE: ShoppingListItem = {
  id: 'article-farine',
  ingredient: {
    id: 'ingredient-farine',
    displayName: 'Farine de blé',
    canonicalUnit: 'GRAM',
    perishable: false,
  },
  label: null,
  quantity: 550,
  unit: 'GRAM',
  productId: null,
  packages: null,
  packageQuantity: null,
  packageLabel: null,
  origin: 'PLAN',
  checked: false,
  position: 0,
};

export const LAIT: ShoppingListItem = {
  id: 'article-lait',
  ingredient: {
    id: 'ingredient-lait',
    displayName: 'Lait demi-écrémé',
    canonicalUnit: 'MILLILITER',
    perishable: true,
  },
  label: null,
  quantity: 1000,
  unit: 'MILLILITER',
  productId: null,
  packages: null,
  packageQuantity: null,
  packageLabel: null,
  origin: 'PLAN',
  checked: true,
  position: 1,
};

/** Un article au conditionnement de son Produit préféré : 700 g, deux boîtes de 400 g. */
export const TOMATES: ShoppingListItem = {
  id: 'article-tomates',
  ingredient: {
    id: 'ingredient-tomates',
    displayName: 'Tomates concassées',
    canonicalUnit: 'GRAM',
    perishable: false,
  },
  label: null,
  quantity: 700,
  unit: 'GRAM',
  productId: 'produit-mutti',
  packages: 2,
  packageQuantity: 400,
  packageLabel: 'boîte',
  origin: 'PLAN',
  checked: false,
  position: 3,
};

export const EPONGES: ShoppingListItem = {
  id: 'article-eponges',
  ingredient: null,
  label: 'Éponges',
  quantity: 2,
  unit: null,
  productId: null,
  packages: null,
  packageQuantity: null,
  packageLabel: null,
  origin: 'MANUAL',
  checked: false,
  position: 2,
};

export const LISTE: ShoppingList = {
  id: 'liste-1',
  mealPlan: { id: 'planning-1', week: '2026-11-02' },
  status: 'OPEN',
  producedAt: '2026-11-01T17:30:00.000Z',
  closedAt: null,
  items: [FARINE, LAIT, EPONGES],
};

export const LISTE_PRECEDENTE: ShoppingList = {
  id: 'liste-0',
  mealPlan: { id: 'planning-0', week: '2026-10-26' },
  status: 'OPEN',
  producedAt: '2026-10-25T17:30:00.000Z',
  closedAt: null,
  items: [],
};

export async function ouvrirLesCourses(
  url: string,
  {
    confirme = true,
  }: {
    /** La réponse du dialogue, ou une promesse que le test résout quand il veut. */
    confirme?: boolean | Promise<boolean>;
  } = {},
) {
  // Les demandes de confirmation, dans l'ordre.
  const confirmations: DccmConfirmOptions[] = [];
  const confirm = async (options: DccmConfirmOptions) => {
    confirmations.push(options);
    return (await confirme) ? true : null;
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter(
        appRoutes.filter(({ path }) => path?.startsWith('courses')),
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
