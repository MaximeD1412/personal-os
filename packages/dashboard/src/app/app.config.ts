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
    provideHttpClient(withFetch(), withInterceptors([sessionInterceptor])),
    { provide: API_BASE_URL, useValue: '/api' },
  ],
};
