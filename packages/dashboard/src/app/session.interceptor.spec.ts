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
import { API_BASE_URL } from './api-base-url';
import { Redirection } from './redirection';
import { sessionInterceptor } from './session.interceptor';

describe('sessionInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let redirection: { vers: jest.Mock };

  beforeEach(() => {
    redirection = { vers: jest.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([sessionInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api' },
        { provide: Redirection, useValue: redirection },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it("renvoie vers la connexion quand l'API ne reconnaît aucune session", () => {
    http.get('/api/health').subscribe({ error: () => undefined });

    httpMock
      .expectOne('/api/health')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(redirection.vers).toHaveBeenCalledWith('/api/auth/login');
  });

  it("ne renvoie nulle part sur une erreur qui n'est pas un défaut de session", () => {
    http.get('/api/health').subscribe({ error: () => undefined });

    httpMock
      .expectOne('/api/health')
      .flush(null, { status: 503, statusText: 'Service Unavailable' });

    expect(redirection.vers).not.toHaveBeenCalled();
  });

  it("ne renvoie pas vers la connexion quand c'est le compte qui est refusé", () => {
    http.get('/api/auth/me').subscribe({ error: () => undefined });

    httpMock
      .expectOne('/api/auth/me')
      .flush(null, { status: 403, statusText: 'Forbidden' });

    expect(redirection.vers).not.toHaveBeenCalled();
  });
});
