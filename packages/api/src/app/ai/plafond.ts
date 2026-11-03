import { aujourdhui, FUSEAU, periodeDuMois } from '@personal-os/contracts';
import type { ReponseIA } from './fournisseur-ia';
import type { IAConfig } from './ia.config';

const UN_MILLION = 1_000_000;

/**
 * Le coût estimé d'une réponse, à partir de ses jetons et du tarif du modèle
 * en configuration. Il est arrondi au centime **supérieur** : le plafond peut
 * se déclencher un peu tôt, jamais trop tard.
 */
export function coutEnCentimes(
  reponse: Pick<ReponseIA, 'jetonsEntree' | 'jetonsSortie'>,
  tarif: Pick<
    IAConfig,
    'prixEntreeParMillionCentimes' | 'prixSortieParMillionCentimes'
  >,
): number {
  const millioniemes =
    reponse.jetonsEntree * tarif.prixEntreeParMillionCentimes +
    reponse.jetonsSortie * tarif.prixSortieParMillionCentimes;

  return Math.ceil(millioniemes / UN_MILLION);
}

/**
 * Le premier instant du mois civil en cours, à Paris : c'est à partir de lui
 * que se somme le plafond. Le 31 à 23 h 30 UTC est déjà le mois suivant à Paris.
 */
export function debutDuMoisCivil(maintenant = new Date()): Date {
  const mois = aujourdhui(FUSEAU, maintenant).slice(0, 'YYYY-MM'.length);

  return new Date(periodeDuMois(mois, FUSEAU).from);
}
