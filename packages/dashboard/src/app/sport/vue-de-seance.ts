import {
  LIBELLES_DE_SPORT,
  titreDeSeance,
  type TrainingSession,
  type TrainingSessionStatus,
} from '@personal-os/contracts';
import {
  allure,
  ecartDAllure,
  ecartDeDistance,
  ecartDeDuree,
  formaterDistance,
  formaterDuree,
} from './mesures';

export type Tonalite = 'info' | 'success' | 'error';

export const STATUTS: Readonly<
  Record<TrainingSessionStatus, { libelle: string; tone: Tonalite }>
> = {
  PLANNED: { libelle: 'Prévue', tone: 'info' },
  DONE: { libelle: 'Réalisée', tone: 'success' },
  MISSED: { libelle: 'Manquée', tone: 'error' },
};

/** Une mesure de la Séance, le réalisé face au prévu (ADR 0022). */
export interface Comparaison {
  libelle: string;
  /** Vide tant que la Séance n'est pas réalisée. */
  realise: string | null;
  prevu: string | null;
  /** « +1,2 km », « −17 s », « = » ; vide quand l'un des deux manque. */
  ecart: string | null;
}

export interface VueDeSeance {
  seance: TrainingSession;
  titre: string;
  sport: string;
  statut: { libelle: string; tone: Tonalite };
  /** Une sortie réalisée sans prévu : elle n'a pas été planifiée. */
  nonPlanifiee: boolean;
  /** Les mesures qui ont une valeur, prévue ou réalisée. */
  comparaisons: Comparaison[];
}

/**
 * Ce que l'écran affiche d'une Séance : l'écart entre le prévu et le réalisé
 * se lit champ par champ, sur le même objet, sans rien stocker de plus.
 */
export function vueDeSeance(seance: TrainingSession): VueDeSeance {
  const prevu = {
    distanceM: seance.plannedDistanceM,
    dureeS: seance.plannedDurationS,
  };
  const realise = {
    distanceM: seance.actualDistanceM,
    dureeS: seance.actualDurationS,
  };
  const allurePrevue = allure(seance.sport, prevu.distanceM, prevu.dureeS);
  const allureRealisee = allure(
    seance.sport,
    realise.distanceM,
    realise.dureeS,
  );

  const comparaisons: Comparaison[] = [
    {
      libelle: 'Distance',
      realise: texte(realise.distanceM, formaterDistance),
      prevu: texte(prevu.distanceM, formaterDistance),
      ecart: ecartDeDistance(prevu.distanceM, realise.distanceM),
    },
    {
      libelle: 'Durée',
      realise: texte(realise.dureeS, formaterDuree),
      prevu: texte(prevu.dureeS, formaterDuree),
      ecart: ecartDeDuree(prevu.dureeS, realise.dureeS),
    },
    {
      libelle: seance.sport === 'BIKE' ? 'Vitesse' : 'Allure',
      realise: allureRealisee,
      prevu: allurePrevue,
      ecart: ecartDAllure(seance.sport, prevu, realise),
    },
  ];

  return {
    seance,
    titre: titreDeSeance(seance),
    sport: LIBELLES_DE_SPORT[seance.sport],
    statut: STATUTS[seance.status],
    nonPlanifiee:
      seance.status === 'DONE' &&
      seance.plannedDistanceM === null &&
      seance.plannedDurationS === null &&
      seance.plannedIntent === null,
    comparaisons: comparaisons.filter(
      ({ realise, prevu }) => realise !== null || prevu !== null,
    ),
  };
}

function texte(
  valeur: number | null,
  formater: (valeur: number) => string,
): string | null {
  return valeur === null ? null : formater(valeur);
}
