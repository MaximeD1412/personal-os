import { aujourdhui, FUSEAU, lundiDe, zWeek } from '@personal-os/contracts';

/*
 * Le Sport se lit par semaine, désignée par son lundi (`zWeek`) dans le lien
 * (`/sport?semaine=2026-10-19`). Les jours et les heures sont ceux de Paris.
 */

export function estUneSemaine(
  valeur: string | null | undefined,
): valeur is string {
  return !!valeur && zWeek.safeParse(valeur).success;
}

/** La semaine en cours, à Paris. */
export function semaineCourante(): string {
  return lundiDe(aujourdhui());
}

/** La semaine, à Paris, où tombe un instant. */
export function semaineDe(instant: string): string {
  return lundiDe(aujourdhui(FUSEAU, new Date(instant)));
}

export function decalerLaSemaine(lundi: string, semaines: number): string {
  const date = enMinuitUtc(lundi);
  date.setUTCDate(date.getUTCDate() + 7 * semaines);
  return date.toISOString().slice(0, 10);
}

const MOIS = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  timeZone: 'UTC',
});

/** « Semaine du 19 au 25 octobre 2026 », mois et année dits une fois s'ils ne changent pas. */
export function libelleDeLaSemaine(lundi: string): string {
  const debut = enMinuitUtc(lundi);
  const fin = enMinuitUtc(decalerLaSemaine(lundi, 1));
  fin.setUTCDate(fin.getUTCDate() - 1);

  const memeAnnee = debut.getUTCFullYear() === fin.getUTCFullYear();
  const memeMois = memeAnnee && debut.getUTCMonth() === fin.getUTCMonth();
  const du = [
    numero(debut),
    memeMois ? '' : MOIS.format(debut),
    memeAnnee ? '' : debut.getUTCFullYear(),
  ]
    .filter(Boolean)
    .join(' ');
  const au = `${numero(fin)} ${MOIS.format(fin)} ${fin.getUTCFullYear()}`;

  return `Semaine du ${du} au ${au}`;
}

const JOUR = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  timeZone: FUSEAU,
});
const NUMERO = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  timeZone: FUSEAU,
});
const HEURE = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: FUSEAU,
});

/** Le jour d'une Séance, à Paris : « mar. » et « 20 ». */
export function jourDe(instant: string): { jour: string; numero: string } {
  const date = new Date(instant);
  return { jour: JOUR.format(date), numero: NUMERO.format(date) };
}

/** L'heure d'une Séance, à Paris : « 07:15 ». */
export function heureDe(instant: string): string {
  return HEURE.format(new Date(instant));
}

function numero(date: Date): string {
  const jour = date.getUTCDate();
  return jour === 1 ? '1er' : String(jour);
}

function enMinuitUtc(jour: string): Date {
  return new Date(`${jour}T00:00:00Z`);
}
