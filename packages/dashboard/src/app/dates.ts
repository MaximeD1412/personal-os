import { aujourdhui, FUSEAU } from '@personal-os/contracts';

/**
 * Les dates telles que l'écran les lit : en français, à Paris (le fuseau de
 * tout calcul, ADR 0030), quel que soit le fuseau du navigateur. Un jour
 * (`zDay`) n'a pas de fuseau : il se calcule et s'écrit à midi UTC, où aucun
 * décalage ne le fait changer de date.
 */

const LANGUE = 'fr-FR';

const HEURE = new Intl.DateTimeFormat(LANGUE, {
  timeZone: FUSEAU,
  hour: '2-digit',
  minute: '2-digit',
});

/** L'heure, à Paris, d'un instant : `09:30`. */
export function heureDe(instant: string): string {
  return HEURE.format(new Date(instant));
}

/** Le jour civil, à Paris, où tombe un instant. */
export function jourDe(instant: string): string {
  return aujourdhui(FUSEAU, new Date(instant));
}

/** Le jour qui suit (ou précède) un jour de `n` jours. */
export function decaler(jour: string, n: number): string {
  const date = aMidi(jour);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

/** Un jour écrit en français : `formaterJour('2026-09-14', { weekday: 'long' })`. */
export function formaterJour(
  jour: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(LANGUE, {
    ...options,
    timeZone: 'UTC',
  }).format(aMidi(jour));
}

/** Un instant écrit en français, à Paris. */
export function formaterInstant(
  instant: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(LANGUE, {
    ...options,
    timeZone: FUSEAU,
  }).format(new Date(instant));
}

function aMidi(jour: string): Date {
  return new Date(`${jour}T12:00:00Z`);
}
