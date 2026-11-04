import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { API_BASE_URL } from './api-base-url';
import { appRoutes } from './app.routes';

/** Le défilement du routeur, vers le fragment ou la position mémorisée. */
export const defilementDuRouteur = withInMemoryScrolling({
  anchorScrolling: 'enabled',
  scrollPositionRestoration: 'enabled',
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes, defilementDuRouteur),
    provideHttpClient(withFetch()),
    // Sous la même origine : nginx relaie `/api/public/` vers l'API.
    { provide: API_BASE_URL, useValue: '/api' },
  ],
};
