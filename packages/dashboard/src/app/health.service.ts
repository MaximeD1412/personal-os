import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { HealthResponse } from '@personal-os/contracts';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  read(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>(`${this.baseUrl}/health`);
  }
}
