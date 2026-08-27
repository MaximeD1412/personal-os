import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Scope } from '@personal-os/contracts';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';

@Injectable({ providedIn: 'root' })
export class EspaceService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  mesEspaces(): Observable<Scope[]> {
    return this.http.get<Scope[]>(`${this.baseUrl}/espaces`);
  }
}
