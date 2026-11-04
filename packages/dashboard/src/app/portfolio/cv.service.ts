import {
  HttpClient,
  httpResource,
  type HttpResourceRef,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Cv, Lang } from '@personal-os/contracts';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';

@Injectable({ providedIn: 'root' })
export class CvService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Les CV déjà téléversés, au plus un par langue. */
  cvs(): HttpResourceRef<Cv[]> {
    return httpResource<Cv[]>(() => `${this.baseUrl}/cv`, { defaultValue: [] });
  }

  /** L'adresse du PDF, que le navigateur télécharge avec la session. */
  lien(lang: Lang): string {
    return `${this.baseUrl}/cv/${lang}`;
  }

  /** Remplace le CV de la langue ; l'API juge le fichier à son contenu. */
  televerser(lang: Lang, fichier: File): Observable<Cv> {
    const formulaire = new FormData();
    formulaire.append('file', fichier);
    return this.http.put<Cv>(`${this.baseUrl}/cv/${lang}`, formulaire);
  }
}
