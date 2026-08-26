import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { CurrentUser, LogoutResponse } from '@personal-os/contracts';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Qui l'API reconnaît derrière le cookie de session. */
  moi(): Observable<CurrentUser> {
    return this.http.get<CurrentUser>(`${this.baseUrl}/auth/me`);
  }

  /**
   * Demande à l'API de révoquer la session.
   *
   * Le corps est vide et c'est normal : le cookie porte tout, et le navigateur
   * n'a jamais rien eu d'autre entre les mains.
   */
  seDeconnecter(): Observable<LogoutResponse> {
    return this.http.post<LogoutResponse>(`${this.baseUrl}/auth/logout`, {});
  }
}
