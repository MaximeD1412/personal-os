import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { Recipe } from '@personal-os/contracts';
import { API_BASE_URL } from '../app/api-base-url';
import { INTERCEPTEURS } from '../app/app.config';
import { appRoutes } from '../app/app.routes';

/**
 * Ouvrir les écrans de recettes depuis un test, par leur URL et leurs vraies
 * routes, devant une API simulée.
 */

export const BASE = 'http://api.test/api';

export const DAHL: Recipe = {
  id: 'recette-1',
  title: 'Dahl de lentilles corail',
  servings: 4,
  steps: ['Rincer les lentilles.', 'Mijoter 20 minutes.'],
  source: 'MANUAL',
  lines: [
    {
      id: 'ligne-1',
      ingredient: { id: 'ingredient-1', displayName: 'Lentilles corail' },
      quantity: 250,
      unit: 'G',
    },
    {
      id: 'ligne-2',
      ingredient: { id: 'ingredient-2', displayName: 'Oignon jaune' },
      quantity: 1,
      unit: 'PIECE',
    },
    {
      id: 'ligne-3',
      ingredient: { id: 'ingredient-3', displayName: 'Huile d’olive' },
      quantity: 1.5,
      unit: 'TBSP',
    },
  ],
  createdAt: '2026-10-20T08:00:00.000Z',
  updatedAt: '2026-10-20T08:00:00.000Z',
};

export const OMELETTE: Recipe = {
  ...DAHL,
  id: 'recette-2',
  title: 'Omelette',
  servings: 1,
  steps: [],
  lines: [DAHL.lines[1]],
};

/** Les écrans de recettes, avec leurs vraies routes. */
export async function ouvrirLesRecettes(url: string) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(
        appRoutes.filter(({ path }) => path?.startsWith('repas/recettes')),
      ),
      provideHttpClient(withInterceptors(INTERCEPTEURS)),
      provideHttpClientTesting(),
      { provide: API_BASE_URL, useValue: BASE },
    ],
  });
  const harness = await RouterTestingHarness.create(url);
  const http = TestBed.inject(HttpTestingController);
  const el = () => harness.routeNativeElement as HTMLElement;

  return { harness, http, el, router: TestBed.inject(Router) };
}
