import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { Project, ProjectSummary } from '@personal-os/contracts';
import { DccmConfirm, type DccmConfirmOptions } from '@personal-os/ui/dccm';
import { API_BASE_URL } from '../app/api-base-url';
import { INTERCEPTEURS } from '../app/app.config';
import { appRoutes } from '../app/app.routes';

/**
 * Ouvrir les écrans des Projets depuis un test, par leur URL et leurs vraies
 * routes, devant une API simulée. La confirmation répond ce qu'on lui dit.
 */

export const BASE = 'http://api.test/api';

export const RELIURE: Project = {
  id: 'projet-1',
  scopeId: 'espace-personnel',
  title: 'Atelier de reliure',
  notes: '## Étapes\n\n- [x] Choisir le papier\n- [ ] Coudre',
  links: [
    { label: 'La reliure', url: 'https://fr.wikipedia.org/wiki/Reliure' },
  ],
  expenses: [
    {
      id: 'depense-2',
      projectId: 'projet-1',
      label: 'Fil de lin ciré',
      amount: { cents: 790, currency: 'EUR' },
      spentOn: '2026-10-02',
      createdAt: '2026-10-02T09:00:00.000Z',
    },
    {
      id: 'depense-1',
      projectId: 'projet-1',
      label: 'Presse à relier',
      amount: { cents: 8900, currency: 'EUR' },
      spentOn: '2026-09-14',
      createdAt: '2026-09-14T09:00:00.000Z',
    },
  ],
  totalSpent: { cents: 9690, currency: 'EUR' },
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-10-12T08:00:00.000Z',
};

export const RESUME_RELIURE: ProjectSummary = {
  id: RELIURE.id,
  scopeId: RELIURE.scopeId,
  title: RELIURE.title,
  totalSpent: RELIURE.totalSpent,
  updatedAt: RELIURE.updatedAt,
};

export const RESUME_POTAGER: ProjectSummary = {
  id: 'projet-2',
  scopeId: 'espace-personnel',
  title: 'Potager sur le balcon',
  totalSpent: { cents: 0, currency: 'EUR' },
  updatedAt: '2026-04-18T08:00:00.000Z',
};

/** Les écrans des Projets, avec leurs vraies routes. */
export async function ouvrirLesProjets(
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
        appRoutes.filter(({ path }) => path?.startsWith('projets')),
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

  return {
    harness,
    http,
    el,
    router: TestBed.inject(Router),
    confirmations,
  };
}
