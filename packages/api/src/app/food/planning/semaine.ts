import { zWeek } from '@personal-os/contracts';

/**
 * Les sept jours civils d'une semaine, de son lundi à son dimanche. Un jour
 * civil n'a pas de fuseau : le calcul se fait à minuit UTC, où aucun
 * changement d'heure ne le décale.
 */
export function joursDeLaSemaine(lundi: string): string[] {
  const debut = new Date(`${zWeek.parse(lundi)}T00:00:00Z`);

  return Array.from({ length: 7 }, (_, decalage) => {
    const jour = new Date(debut);
    jour.setUTCDate(debut.getUTCDate() + decalage);
    return jour.toISOString().slice(0, 10);
  });
}

/** Un Repas planifié tombe dans la semaine de son planning, jamais à côté. */
export function estDansLaSemaine(jour: string, lundi: string): boolean {
  return joursDeLaSemaine(lundi).includes(jour);
}
