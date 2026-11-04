import { signal } from '@angular/core';
import { Largeur } from '../app/largeur';

/** Une fenêtre d'une largeur donnée, pour les écrans qui en dépendent. */
export function fenetreDe(pixels: number) {
  return {
    provide: Largeur,
    useValue: { auMoins: (seuil: number) => signal(pixels >= seuil) },
  };
}
