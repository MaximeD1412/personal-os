import {
  HttpErrorResponse,
  type HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import { Redirection } from './redirection';

/**
 * Devant un 401, repart chercher une session chez Authentik.
 *
 * Le geste est posé une fois, pour toutes les requêtes : le tableau de bord
 * est entièrement protégé, il n'a aucun écran à montrer à qui n'a pas de
 * session. Le laisser à chaque écran reviendrait à parier qu'aucun n'oubliera.
 *
 * 403 est délibérément exclu : il dit « ce compte n'entre pas ici », et
 * repartir vers Authentik rouvrirait la même session pour se faire refuser à
 * l'identique, en boucle.
 */
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
