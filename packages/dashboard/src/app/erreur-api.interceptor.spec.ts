import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { ApiError } from '@personal-os/contracts';
import { API_BASE_URL } from './api-base-url';
import { INTERCEPTEURS } from './app.config';
import { Redirection } from './redirection';

describe('erreurApiInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let redirection: { vers: jest.Mock };

  beforeEach(() => {
    redirection = { vers: jest.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors(INTERCEPTEURS)),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api' },
        { provide: Redirection, useValue: redirection },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  /** L'erreur que reçoit l'appelant, quand l'API répond `corps` avec `status`. */
  function erreurRecue(corps: unknown, status: number): ApiError {
    let recue: unknown;
    http.get('/api/events').subscribe({ error: (erreur) => (recue = erreur) });

    httpMock
      .expectOne('/api/events')
      .flush(corps, { status, statusText: 'Erreur' });

    return recue as ApiError;
  }

  it("rend l'enveloppe de l'API telle quelle, champs compris", () => {
    const enveloppe: ApiError = {
      status: 400,
      code: 'request.invalid',
      message: 'La requête ne respecte pas le schéma attendu.',
      fields: [
        { path: 'title', code: 'too_small', message: "L'intitulé est requis." },
      ],
    };

    expect(erreurRecue(enveloppe, 400)).toMatchObject(enveloppe);
  });

  it("rend le message d'une règle métier, sans champs", () => {
    const recue = erreurRecue(
      {
        status: 422,
        code: 'event.period_reversed',
        message: 'La fin précède le début.',
      },
      422,
    );

    expect(recue).toMatchObject({
      status: 422,
      code: 'event.period_reversed',
      message: 'La fin précède le début.',
    });
    expect(recue.fields).toBeUndefined();
  });

  it("dit que le serveur n'a pas répondu quand le corps n'est pas une enveloppe", () => {
    expect(erreurRecue('<html>Bad Gateway</html>', 502)).toMatchObject({
      status: 502,
      code: 'network',
      message: "Le serveur n'a pas répondu.",
    });
  });

  it("dit que le serveur n'a pas répondu quand la requête n'a pas abouti", () => {
    let recue: unknown;
    http.get('/api/events').subscribe({ error: (erreur) => (recue = erreur) });

    httpMock.expectOne('/api/events').error(new ProgressEvent('error'));

    expect(recue).toMatchObject({
      status: 0,
      code: 'network',
      message: "Le serveur n'a pas répondu.",
    });
  });

  it("laisse l'intercepteur de session renvoyer vers la connexion sur un 401", () => {
    const recue = erreurRecue(
      { status: 401, code: 'auth.unauthenticated', message: 'Connectez-vous.' },
      401,
    );

    expect(redirection.vers).toHaveBeenCalledWith('/api/auth/login');
    expect(recue).toMatchObject({ code: 'auth.unauthenticated' });
  });
});
