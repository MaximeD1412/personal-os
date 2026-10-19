import * as z from 'zod';

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

/**
 * Une période, bornes incluses. Toute lecture d'objets datés en exige une
 * (ADR 0030). Une fin qui précède le début se refuse sur `to` ; les bornes se
 * comparent comme des instants, pas comme des chaînes.
 */
export const zPeriod = /* @__PURE__ */ z
  .object({ from: zInstant, to: zInstant })
  // Une borne mal formée est déjà refusée sur son propre champ : la période
  // ne se juge qu'entre deux instants.
  .refine(({ from, to }) => !(Date.parse(to) < Date.parse(from)), {
    path: ['to'],
    error: "La fin d'une période ne précède pas son début.",
  });

/** Le fuseau de tout calcul relatif : aujourd'hui, cette semaine, une péremption. */
export const FUSEAU = 'Europe/Paris';

const MOIS = /^(\d{4})-(0[1-9]|1[0-2])$/;

/**
 * La période d'un mois `YYYY-MM`, du premier jour à minuit au dernier jour à
 * 23:59:59.999, dans le fuseau donné.
 */
export function periodeDuMois(
  mois: string,
  fuseau = FUSEAU,
): { from: string; to: string } {
  const correspondance = MOIS.exec(mois);
  if (!correspondance) {
    throw new Error(`${mois} n'est pas un mois YYYY-MM.`);
  }
  const annee = Number(correspondance[1]);
  const indice = Number(correspondance[2]) - 1;

  const debut = minuitDans(fuseau, annee, indice);
  const suivant = minuitDans(fuseau, annee, indice + 1);

  return {
    from: debut.toISOString(),
    to: new Date(suivant.getTime() - 1).toISOString(),
  };
}

/**
 * Le premier jour d'un mois à minuit, heure du fuseau. Minuit ne tombe jamais
 * dans un changement d'heure à Paris : un seul décalage le désigne.
 */
function minuitDans(fuseau: string, annee: number, indice: number): Date {
  const minuitUtc = Date.UTC(annee, indice, 1);
  const premier = minuitUtc - decalage(fuseau, minuitUtc);

  return new Date(minuitUtc - decalage(fuseau, premier));
}

/** L'avance du fuseau sur UTC à un instant, en millisecondes. */
function decalage(fuseau: string, instant: number): number {
  const parties = new Intl.DateTimeFormat('en-US', {
    timeZone: fuseau,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(instant));
  const partie = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parties.find((p) => p.type === type)?.value);

  const murale = Date.UTC(
    partie('year'),
    partie('month') - 1,
    partie('day'),
    partie('hour'),
    partie('minute'),
    partie('second'),
  );

  return murale - Math.floor(instant / 1000) * 1000;
}

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
