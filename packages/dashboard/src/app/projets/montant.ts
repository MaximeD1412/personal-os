import type { Project } from '@personal-os/contracts';

type Montant = Project['totalSpent'];

const EUROS = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
});

/** Un montant tel qu'on l'affiche : « 1 240,00 € ». */
export function formaterMontant({ cents }: Montant): string {
  // Une division par 100 d'un entier de centimes tombe juste à l'affichage :
  // le calcul, lui, reste en centimes.
  return EUROS.format(cents / 100);
}

const SAISIE = /^(\d+)(?:,(\d{1,2}))?$/;

/**
 * Les centimes d'un montant saisi en euros (« 12,50 », « 1 240 », « 12.99 »),
 * lus comme du texte : jamais d'euros en virgule flottante, qui feraient de
 * 4,35 € 434 centimes. `null` pour une saisie illisible, négative ou plus fine
 * que le centime.
 */
export function centimesDepuisSaisie(saisie: string): number | null {
  const texte = saisie.replace(/[\s\u00a0\u202f€]/g, '').replace('.', ',');
  const lu = SAISIE.exec(texte);
  if (!lu) {
    return null;
  }

  const euros = Number(lu[1]);
  const centimes = Number((lu[2] ?? '').padEnd(2, '0'));
  return euros * 100 + centimes;
}

const JOUR = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * Un jour civil tel qu'on l'affiche : « 2 oct. 2026 ». Le jour n'est pas un
 * instant : il se lit à midi UTC, loin de tout changement de date.
 */
export function formaterJour(jour: string): string {
  return JOUR.format(new Date(`${jour}T12:00:00Z`));
}
