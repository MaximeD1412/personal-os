import { Injectable, signal, type Signal } from '@angular/core';

/**
 * Les largeurs d'écran qui changent la composition d'un écran, et non sa
 * seule mise en forme : une grille du mois ou un bandeau de la semaine, un
 * panneau ou une feuille. Ce que le CSS suffit à adapter reste au CSS.
 */
@Injectable({ providedIn: 'root' })
export class Largeur {
  private readonly seuils = new Map<number, Signal<boolean>>();

  /** Vrai tant que la fenêtre fait au moins `pixels` de large. */
  auMoins(pixels: number): Signal<boolean> {
    let suivi = this.seuils.get(pixels);
    if (!suivi) {
      const requete = matchMedia(`(min-width: ${pixels}px)`);
      const atteint = signal(requete.matches);
      requete.addEventListener('change', ({ matches }) => atteint.set(matches));
      suivi = atteint.asReadonly();
      this.seuils.set(pixels, suivi);
    }
    return suivi;
  }
}

/** Les seuils du design system (`DccmShell`). */
export const TABLETTE = 768;
export const BUREAU = 1280;
