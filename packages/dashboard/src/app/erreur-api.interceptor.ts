import {
  HttpErrorResponse,
  type HttpInterceptorFn,
} from '@angular/common/http';
import {
  zApiError,
  type ApiError,
  type ApiFieldError,
} from '@personal-os/contracts';
import { catchError, throwError } from 'rxjs';

/**
 * L'enveloppe de l'API (ADR 0030), sous la forme d'une `Error` : c'est ce que
 * reçoit toute lecture ou écriture qui échoue. Une `httpResource` garde ainsi
 * l'erreur telle quelle, sans l'envelopper dans une erreur à elle.
 */
export class ErreurApi extends Error implements ApiError {
  override readonly name = 'ErreurApi';
  readonly status: number;
  readonly code: string;
  readonly fields?: ApiFieldError[];

  constructor({ status, code, message, fields }: ApiError) {
    super(message);
    this.status = status;
    this.code = code;
    if (fields) {
      this.fields = fields;
    }
  }
}

/**
 * L'unique traduction des erreurs HTTP : l'écran affiche le `message` de
 * l'API, jamais un message de remplacement. Seul un corps qui n'est pas une
 * enveloppe (un proxy qui répond à la place de l'API, une requête qui
 * n'aboutit pas) reçoit le message réseau.
 */
export const erreurApiInterceptor: HttpInterceptorFn = (request, next) =>
  next(request).pipe(
    catchError((erreur: unknown) =>
      throwError(() =>
        erreur instanceof HttpErrorResponse ? versErreurApi(erreur) : erreur,
      ),
    ),
  );

function versErreurApi(reponse: HttpErrorResponse): ErreurApi {
  const enveloppe = zApiError.safeParse(reponse.error);

  return new ErreurApi(
    enveloppe.success
      ? enveloppe.data
      : {
          status: reponse.status,
          code: 'network',
          message: "Le serveur n'a pas répondu.",
        },
  );
}
