import { aujourdhui, FUSEAU } from '@personal-os/contracts';

/**
 * Un mois, sous la forme `YYYY-MM` que saisit un champ `month`. Le Calendrier
 * en affiche un à la fois, et le désigne ainsi dans ses liens.
 */
const MOIS = /^\d{4}-(0[1-9]|1[0-2])$/;

export function estUnMois(valeur: string | null | undefined): valeur is string {
  return !!valeur && MOIS.test(valeur);
}

/** Le mois en cours, à Paris. */
export function moisCourant(): string {
  return aujourdhui().slice(0, 7);
}

/** Le mois, à Paris, où tombe un instant. */
export function moisDe(instant: string): string {
  return aujourdhui(FUSEAU, new Date(instant)).slice(0, 7);
}
