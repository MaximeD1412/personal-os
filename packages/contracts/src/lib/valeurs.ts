import { z } from 'zod';

/**
 * Les formes de valeur (ADR 0030). Chacune n'a qu'un schéma, celui-ci : aucun
 * module n'en redéfinit. Les dates restent des chaînes dans les contrats ; la
 * conversion en `Date` se fait au bord du dépôt.
 *
 * Les schémas sont marqués purs : un écran qui importe une autre valeur de
 * `contracts` n'embarque pas zod tant qu'il n'en utilise aucun.
 */

/** Un instant, ISO-8601 en UTC (`Z`), stocké en `timestamptz`. */
export const zInstant = /* @__PURE__ */ z.iso.datetime();

/** Un jour civil `YYYY-MM-DD`, stocké en `date`, jamais converti en instant. */
export const zDay = /* @__PURE__ */ z.iso.date();

const LUNDI = 1;

/** Une semaine, désignée par son lundi. */
export const zWeek = /* @__PURE__ */ zDay.refine(
  (jour) => jourDeLaSemaine(jour) === LUNDI,
  {
    error: 'Une semaine se désigne par son lundi.',
  },
);

/** Un montant, en entier de centimes. */
export const zCents = /* @__PURE__ */ z.int().min(0);

/** Un montant et sa devise, l'euro par défaut. */
export const zMoney = /* @__PURE__ */ z.object({
  cents: zCents,
  currency: /* @__PURE__ */ z.literal('EUR').default('EUR'),
});

/** Le fuseau de tout calcul relatif : aujourd'hui, cette semaine, une péremption. */
export const FUSEAU = 'Europe/Paris';

/** Le jour civil en cours dans un fuseau, sous la forme d'un `zDay`. */
export function aujourdhui(fuseau = FUSEAU, maintenant = new Date()): string {
  const parties = new Intl.DateTimeFormat('en-US', {
    timeZone: fuseau,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(maintenant);
  const partie = (type: Intl.DateTimeFormatPartTypes) =>
    parties.find((p) => p.type === type)?.value;

  return `${partie('year')}-${partie('month')}-${partie('day')}`;
}

/** Le lundi de la semaine d'un jour civil, le jour lui-même s'il est un lundi. */
export function lundiDe(jour: string): string {
  const date = enMinuitUtc(zDay.parse(jour));
  const joursDepuisLundi = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - joursDepuisLundi);

  return date.toISOString().slice(0, 10);
}

// Un jour civil n'a pas de fuseau : le calcul se fait à minuit UTC, où aucun
// changement d'heure ne peut le décaler.
function enMinuitUtc(jour: string): Date {
  return new Date(`${jour}T00:00:00Z`);
}

function jourDeLaSemaine(jour: string): number {
  return enMinuitUtc(jour).getUTCDay();
}
