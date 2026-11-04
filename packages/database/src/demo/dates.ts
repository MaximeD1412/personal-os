/**
 * Le fuseau de calcul de l'application (ADR 0030). Le jeu de démo se cale sur
 * le jour qu'il est **à Paris**, et ses heures sont des heures de Paris : un
 * rendez-vous à 9 h 30 reste à 9 h 30 de part et d'autre d'un changement
 * d'heure.
 */
const FUSEAU = 'Europe/Paris';

const PARTIES = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSEAU,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** L'heure qu'affiche une horloge de Paris à cet instant, lue comme si c'était l'UTC. */
function horlogeDeParis(instant: Date): number {
  const parties = PARTIES.formatToParts(instant);
  const valeur = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parties.find((partie) => partie.type === type)?.value);

  return Date.UTC(
    valeur('year'),
    valeur('month') - 1,
    valeur('day'),
    valeur('hour'),
    valeur('minute'),
    valeur('second'),
  );
}

/** Le jour (`YYYY-MM-DD`) qu'il est à Paris à cet instant. */
export function jourAParis(instant: Date): string {
  return new Date(horlogeDeParis(instant)).toISOString().slice(0, 10);
}

/** Le jour situé `decalage` jours après `jour` (avant, s'il est négatif). */
export function decalerLeJour(jour: string, decalage: number): string {
  const [annee, mois, quantieme] = jour.split('-').map(Number);
  return new Date(Date.UTC(annee, mois - 1, quantieme + decalage))
    .toISOString()
    .slice(0, 10);
}

/** L'instant où une horloge de Paris indique `heure` (`HH:MM`) le `jour` donné. */
export function aParis(jour: string, heure: string): Date {
  const [annee, mois, quantieme] = jour.split('-').map(Number);
  const [heures, minutes] = heure.split(':').map(Number);
  const voulu = Date.UTC(annee, mois - 1, quantieme, heures, minutes);

  // L'écart à l'UTC dépend de l'instant cherché : on le mesure une première
  // fois à l'instant naïf, puis à l'estimation qui en sort, ce qui suffit à
  // passer un changement d'heure survenu entre les deux.
  const ecart = (instant: number): number =>
    horlogeDeParis(new Date(instant)) - instant;
  const estimation = voulu - ecart(voulu);
  return new Date(voulu - ecart(estimation));
}
