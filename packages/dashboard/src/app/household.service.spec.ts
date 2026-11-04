import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Household } from '@personal-os/contracts';
import { API_BASE_URL } from './api-base-url';
import { HouseholdService } from './household.service';

const BASE = 'http://api.test/api';

const FOYER: Household = {
  id: 'foyer',
  name: 'Foyer',
  members: [
    { id: 'compte-a', displayName: 'Camille' },
    { id: 'compte-b', displayName: 'dominique' },
  ],
};

describe('HouseholdService', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lit le Foyer et ses deux Comptes', async () => {
    const service = TestBed.inject(HouseholdService);
    const foyer = TestBed.runInInjectionContext(() => service.foyer());
    TestBed.tick();

    const requete = httpMock.expectOne(`${BASE}/household`);
    expect(requete.request.method).toBe('GET');
    requete.flush(FOYER);
    await TestBed.inject(ApplicationRef).whenStable();

    expect(foyer.value()).toEqual(FOYER);
  });
});
