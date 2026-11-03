import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { MealPlan, MealPlanEntry, MealWish } from '@personal-os/contracts';
import { DccmConfirm, type DccmConfirmOptions } from '@personal-os/ui/dccm';
import { filter, firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../app/api-base-url';
import { INTERCEPTEURS } from '../app/app.config';
import { appRoutes } from '../app/app.routes';
import { BASE } from './catalogue';
import { FOYER } from './preferences';

/**
 * Ouvrir les écrans du Planning de repas depuis un test, par leur URL et
 * leurs vraies routes, devant une API simulée. Les specs figent l'horloge à
 * `MAINTENANT` (ce fichier entre dans le build : pas de `jest` ici). La
 * confirmation d'une transition répond ce que le test lui dit.
 */

export { BASE, FOYER };

/** Mardi 20 octobre 2026, à Paris. */
export const MAINTENANT = new Date('2026-10-20T10:00:00.000Z');
export const LUNDI = '2026-10-19';

/** La fin de la prochaine navigation : l'écran d'arrivée a lancé ses lectures. */
export function arrivee(router: Router): Promise<unknown> {
  return firstValueFrom(
    router.events.pipe(
      filter((evenement) => evenement instanceof NavigationEnd),
    ),
  );
}

export const DAHL_DU_LUNDI: MealPlanEntry = {
  id: 'repas-1',
  day: '2026-10-19',
  moment: 'DINNER',
  recipe: { id: 'recette-1', title: 'Dahl de lentilles corail' },
  title: null,
  participantIds: ['compte-a', 'compte-b'],
  guestCount: 2,
  servings: 4,
  decision: 'APPROVED',
  createdAt: '2026-10-18T08:00:00.000Z',
};

export const RESTES_DU_MERCREDI: MealPlanEntry = {
  id: 'repas-2',
  day: '2026-10-21',
  moment: 'LUNCH',
  recipe: null,
  title: 'Restes du dahl',
  participantIds: ['compte-a'],
  guestCount: 0,
  servings: 1,
  decision: 'PROPOSED',
  createdAt: '2026-10-18T08:01:00.000Z',
};

export const PLANNING: MealPlan = {
  id: 'planning-1',
  week: LUNDI,
  status: 'OPEN',
  entries: [DAHL_DU_LUNDI, RESTES_DU_MERCREDI],
  createdAt: '2026-10-18T08:00:00.000Z',
};

/** Une envie de Léa, puis une Recette souhaitée par Maxime. */
export const ENVIE_DE_POISSON: MealWish = {
  id: 'souhait-1',
  week: LUNDI,
  recipe: null,
  text: 'Un plat de poisson',
  authorId: 'compte-b',
  createdAt: '2026-10-17T08:00:00.000Z',
};

export const DAHL_SOUHAITE: MealWish = {
  id: 'souhait-2',
  week: LUNDI,
  recipe: { id: 'recette-1', title: 'Dahl de lentilles corail' },
  text: null,
  authorId: 'compte-a',
  createdAt: '2026-10-17T09:00:00.000Z',
};

export const SOUHAITS: MealWish[] = [ENVIE_DE_POISSON, DAHL_SOUHAITE];

export async function ouvrirLePlanning(
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
        appRoutes.filter(({ path }) => path?.startsWith('repas/planning')),
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
