import { Injectable } from '@angular/core';

/**
 * Quitte l'application pour une adresse extérieure.
 *
 * Passer par un service plutôt que par `window.location` directement n'est pas
 * une précaution de style : le départ vers Authentik est le cœur du flux
 * authorization code, et une navigation réelle ne se laisse ni observer ni
 * annuler dans un test.
 */
@Injectable({ providedIn: 'root' })
export class Redirection {
  vers(url: string): void {
    window.location.assign(url);
  }
}
