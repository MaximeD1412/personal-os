import {
  HttpErrorResponse,
  type HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import { Redirection } from './redirection';

export const sessionInterceptor: HttpInterceptorFn = (request, next) => {
  const redirection = inject(Redirection);
  const baseUrl = inject(API_BASE_URL);

  return next(request).pipe(
    catchError((erreur: unknown) => {
      if (erreur instanceof HttpErrorResponse && erreur.status === 401) {
        redirection.vers(`${baseUrl}/auth/login`);
      }
      return throwError(() => erreur);
    }),
  );
};
