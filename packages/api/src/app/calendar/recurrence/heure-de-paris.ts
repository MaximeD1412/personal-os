import { FUSEAU } from '@personal-os/contracts';

/*
 * L'heure murale de Paris, ce que lit une horloge accrochée au mur : c'est en
 * elle que se déroule une règle de récurrence (ADR 0030). Un jour civil y est
 * un nombre de jours depuis le 1er janvier 1970, ce qui rend l'arithmétique
 * des jours triviale ; seul le passage à un instant consulte le fuseau.
 */

export const JOUR = 86_400_000;

/** Un jour civil de Paris, en nombre de jours depuis le 1er janvier 1970. */
export type JourCivil = number;

/** Un instant lu sur l'horloge de Paris : son jour, et l'heure dans ce jour. */
export interface HeureMurale {
  jour: JourCivil;
  /** Les millisecondes écoulées depuis minuit, heure de Paris. */
  heure: number;
}

const HORLOGE = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSEAU,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

/** L'heure murale d'un instant, comptée comme si elle était en UTC. */
function murale(instant: number): number {
  const parties = HORLOGE.formatToParts(new Date(instant));
  const partie = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parties.find((p) => p.type === type)?.value);
  const millisecondes = ((instant % 1000) + 1000) % 1000;

  return (
    Date.UTC(
      partie('year'),
      partie('month') - 1,
      partie('day'),
      partie('hour'),
      partie('minute'),
      partie('second'),
    ) + millisecondes
  );
}

export function enHeureMurale(instant: Date): HeureMurale {
  const heureMurale = murale(instant.getTime());
  const jour = Math.floor(heureMurale / JOUR);

  return { jour, heure: heureMurale - jour * JOUR };
}

/** Le jour civil de Paris d'un instant. */
export function jourDe(instant: Date): JourCivil {
  return enHeureMurale(instant).jour;
}

/** Le jour de la semaine d'un jour civil, de 0 (lundi) à 6 (dimanche). */
export function jourDeLaSemaine(jour: JourCivil): number {
  // Le 1er janvier 1970 était un jeudi.
  return (((jour + 3) % 7) + 7) % 7;
}

/**
 * L'instant où l'horloge de Paris affiche ce jour et cette heure.
 *
 * Autour d'un changement d'heure, deux décalages sont possibles : celui de la
 * veille et celui du lendemain. Une heure qui existe deux fois se lit avec le
 * premier qui convient, soit la première fois qu'elle a lieu ; une heure qui
 * n'existe pas, avec le décalage d'avant le saut (RFC 5545, § 3.3.5).
 */
export function depuisHeureMurale(jour: JourCivil, heure: number): Date {
  const voulue = jour * JOUR + heure;
  const avant = voulue - murale(voulue - JOUR) + (voulue - JOUR);
  const apres = voulue - murale(voulue + JOUR) + (voulue + JOUR);

  for (const candidat of [Math.min(avant, apres), Math.max(avant, apres)]) {
    if (murale(candidat) === voulue) {
      return new Date(candidat);
    }
  }

  return new Date(avant);
}
