import {
  FREQUENCES,
  JOURS_DE_LA_SEMAINE,
  type Recurrence,
  type Weekday,
} from '@personal-os/contracts';

type Frequence = (typeof FREQUENCES)[number];

/** Comment une série finit : jamais, à une date, ou après un nombre d'occurrences. */
export type FinDeRepetition = 'jamais' | 'date' | 'nombre';

/**
 * La règle de récurrence telle que l'écran la saisit. Les valeurs d'un choix
 * masqué (la date quand la série finit après un nombre, les jours d'une série
 * mensuelle) sont gardées : y revenir les retrouve, mais elles ne partent pas.
 */
export interface SaisieDeRecurrence {
  active: boolean;
  frequence: Frequence;
  intervalle: number;
  jours: readonly Weekday[];
  fin: FinDeRepetition;
  /** Le dernier jour, `YYYY-MM-DD`, quand la série finit à une date. */
  jusquAu: string;
  nombre: number;
}

export const SANS_REPETITION: SaisieDeRecurrence = {
  active: false,
  frequence: 'WEEKLY',
  intervalle: 1,
  jours: [],
  fin: 'jamais',
  jusquAu: '',
  nombre: 10,
};

export const FREQUENCES_OFFERTES: readonly {
  valeur: Frequence;
  libelle: string;
  unite: string;
}[] = [
  { valeur: 'DAILY', libelle: 'Quotidienne', unite: 'jour(s)' },
  { valeur: 'WEEKLY', libelle: 'Hebdomadaire', unite: 'semaine(s)' },
  { valeur: 'MONTHLY', libelle: 'Mensuelle', unite: 'mois' },
  { valeur: 'YEARLY', libelle: 'Annuelle', unite: 'an(s)' },
];

export const JOURS_OFFERTS: readonly {
  valeur: Weekday;
  initiale: string;
  nom: string;
}[] = [
  { valeur: 'MO', initiale: 'L', nom: 'lundi' },
  { valeur: 'TU', initiale: 'M', nom: 'mardi' },
  { valeur: 'WE', initiale: 'M', nom: 'mercredi' },
  { valeur: 'TH', initiale: 'J', nom: 'jeudi' },
  { valeur: 'FR', initiale: 'V', nom: 'vendredi' },
  { valeur: 'SA', initiale: 'S', nom: 'samedi' },
  { valeur: 'SU', initiale: 'D', nom: 'dimanche' },
];

export const FINS_OFFERTES: readonly {
  valeur: FinDeRepetition;
  libelle: string;
}[] = [
  { valeur: 'jamais', libelle: 'Jamais' },
  { valeur: 'date', libelle: 'À une date' },
  { valeur: 'nombre', libelle: 'Après un nombre' },
];

/** Seules les séries quotidiennes et hebdomadaires choisissent leurs jours. */
export function choisitSesJours(frequence: Frequence): boolean {
  return frequence === 'DAILY' || frequence === 'WEEKLY';
}

export function uniteDe(frequence: Frequence): string {
  return (
    FREQUENCES_OFFERTES.find(({ valeur }) => valeur === frequence)?.unite ?? ''
  );
}

/** La règle d'un Événement, rendue à l'écran. */
export function versSaisie(regle: Recurrence | null): SaisieDeRecurrence {
  if (!regle) {
    return SANS_REPETITION;
  }

  return {
    active: true,
    frequence: regle.freq,
    intervalle: regle.interval,
    jours: regle.byWeekday ?? [],
    fin:
      regle.until !== undefined
        ? 'date'
        : regle.count !== undefined
          ? 'nombre'
          : 'jamais',
    jusquAu: regle.until ?? '',
    nombre: regle.count ?? SANS_REPETITION.nombre,
  };
}

/**
 * La saisie, dans les termes du contrat : `null` sans répétition. Une saisie
 * incomplète (une fin à une date qu'on n'a pas choisie, un intervalle vide)
 * ne fait pas de règle (`undefined`) : l'écran attend qu'elle le soit.
 */
export function versRegle(
  saisie: SaisieDeRecurrence,
): Recurrence | null | undefined {
  if (!saisie.active) {
    return null;
  }
  if (
    !estUnCompte(saisie.intervalle) ||
    (saisie.fin === 'date' && !saisie.jusquAu) ||
    (saisie.fin === 'nombre' && !estUnCompte(saisie.nombre))
  ) {
    return undefined;
  }

  const jours = choisitSesJours(saisie.frequence)
    ? JOURS_DE_LA_SEMAINE.filter((jour) => saisie.jours.includes(jour))
    : [];

  return {
    freq: saisie.frequence,
    interval: saisie.intervalle,
    ...(jours.length > 0 ? { byWeekday: jours } : {}),
    ...(saisie.fin === 'date' ? { until: saisie.jusquAu } : {}),
    ...(saisie.fin === 'nombre' ? { count: saisie.nombre } : {}),
  };
}

function estUnCompte(valeur: number): boolean {
  return Number.isInteger(valeur) && valeur >= 1;
}

/** Deux règles, comparées par ce qu'elles disent et non par l'ordre de leurs clés. */
export function memeRegle(
  gauche: Recurrence | null,
  droite: Recurrence | null,
): boolean {
  return canonique(gauche) === canonique(droite);
}

function canonique(regle: Recurrence | null): string {
  if (!regle) {
    return 'null';
  }

  return JSON.stringify([
    regle.freq,
    regle.interval,
    JOURS_DE_LA_SEMAINE.filter((jour) => regle.byWeekday?.includes(jour)),
    regle.until ?? null,
    regle.count ?? null,
  ]);
}
