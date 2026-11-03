import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { Cv } from '@personal-os/contracts';
import { API_BASE_URL } from '../app/api-base-url';
import { INTERCEPTEURS } from '../app/app.config';
import { appRoutes } from '../app/app.routes';

/**
 * Ouvrir les écrans du portfolio depuis un test, par leur URL et leurs vraies
 * routes, devant une API simulée.
 */

export const BASE = 'http://api.test/api';

export const CV_FR: Cv = {
  lang: 'FR',
  size: 480 * 1024,
  uploadedAt: '2026-05-15T08:00:00.000Z',
};

export async function ouvrirLePortfolio(url: string) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(
        appRoutes.filter(({ path }) => path?.startsWith('portfolio')),
      ),
      provideHttpClient(withInterceptors(INTERCEPTEURS)),
      provideHttpClientTesting(),
      { provide: API_BASE_URL, useValue: BASE },
    ],
  });
  const harness = await RouterTestingHarness.create(url);
  const http = TestBed.inject(HttpTestingController);
  const el = () => harness.routeNativeElement as HTMLElement;

  return { harness, http, el };
}
