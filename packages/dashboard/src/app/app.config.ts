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
import { erreurApiInterceptor } from './erreur-api.interceptor';
import { sessionInterceptor } from './session.interceptor';

/**
 * Une réponse remonte les intercepteurs du dernier au premier. La traduction
 * en `ErreurApi` est donc placée devant : elle passe après l'intercepteur de
 * session, qui voit encore la `HttpErrorResponse` d'origine.
 */
export const INTERCEPTEURS = [erreurApiInterceptor, sessionInterceptor];

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideHttpClient(withFetch(), withInterceptors(INTERCEPTEURS)),
    { provide: API_BASE_URL, useValue: '/api' },
  ],
};
