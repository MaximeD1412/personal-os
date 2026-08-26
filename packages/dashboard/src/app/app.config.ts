import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from './api-base-url';
import { appRoutes } from './app.routes';
import { sessionInterceptor } from './session.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    // L'intercepteur de session est posé ici, une fois : le tableau de bord est
    // entièrement protégé, et aucun écran n'a à se souvenir de le faire.
    provideHttpClient(withFetch(), withInterceptors([sessionInterceptor])),
    // Servi derrière le même hôte que l'API en production (proxy nginx).
    { provide: API_BASE_URL, useValue: '/api' },
  ],
};
