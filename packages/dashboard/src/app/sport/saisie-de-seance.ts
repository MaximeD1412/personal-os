import {
  lireDistance,
  lireDuree,
  saisieDeDistance,
  saisieDeDuree,
} from './mesures';

/** Le prévu ou le réalisé : les deux se saisissent avec les mêmes champs. */
export type Volet = 'planned' | 'actual';

/** Ce que les champs d'un volet portent, tel qu'on le tape. */
export interface SaisieDeMesures {
  /** En kilomètres : « 10,5 ». */
  distance: string;
  /** « 45 », « 45:30 » ou « 1:04:30 ». */
  duree: string;
  /** L'intention du prévu, les notes du réalisé. */
  texte: string;
}

export const SAISIE_VIERGE: SaisieDeMesures = {
  distance: '',
  duree: '',
  texte: '',
};

/** Les champs du contrat qu'un volet remplit. */
export function champsDu(volet: Volet) {
  return volet === 'planned'
    ? ({
        distance: 'plannedDistanceM',
        duree: 'plannedDurationS',
        texte: 'plannedIntent',
      } as const)
    : ({
        distance: 'actualDistanceM',
        duree: 'actualDurationS',
        texte: 'actualNotes',
      } as const);
}

/** Les valeurs d'un volet dans les termes du contrat : `null` pour un champ vide. */
export interface MesuresLues {
  distanceM: number | null;
  dureeS: number | null;
  texte: string | null;
}

/**
 * Lit un volet. Un champ rempli qu'on ne sait pas lire n'est jamais envoyé
 * vide en silence : il revient en erreur, sous son champ, avec le chemin du
 * contrat qu'il aurait rempli.
 */
export function lireLesMesures(
  saisie: SaisieDeMesures,
  volet: Volet,
): { mesures: MesuresLues; erreurs: Record<string, string> } {
  const champs = champsDu(volet);
  const erreurs: Record<string, string> = {};
  const distanceM = saisie.distance.trim()
    ? lireDistance(saisie.distance)
    : null;
  const dureeS = saisie.duree.trim() ? lireDuree(saisie.duree) : null;

  if (saisie.distance.trim() && distanceM === null) {
    erreurs[champs.distance] = 'Une distance en kilomètres, par exemple 10,5.';
  }
  if (saisie.duree.trim() && dureeS === null) {
    erreurs[champs.duree] =
      'Une durée en minutes (45), ou en heures et minutes (1:04:30).';
  }

  return {
    mesures: { distanceM, dureeS, texte: saisie.texte.trim() || null },
    erreurs,
  };
}

/** Les valeurs du contrat, rendues aux champs qui les saisissent. */
export function saisieDesMesures(
  mesures: Partial<MesuresLues>,
): SaisieDeMesures {
  return {
    distance: mesures.distanceM ? saisieDeDistance(mesures.distanceM) : '',
    duree: mesures.dureeS ? saisieDeDuree(mesures.dureeS) : '',
    texte: mesures.texte ?? '',
  };
}

/** Un instant, en heure locale, tel qu'un champ `datetime-local` le saisit. */
export function versChampLocal(iso: string): string {
  const instant = new Date(iso);
  const deuxChiffres = (valeur: number) => valeur.toString().padStart(2, '0');

  return (
    `${instant.getFullYear()}-${deuxChiffres(instant.getMonth() + 1)}` +
    `-${deuxChiffres(instant.getDate())}` +
    `T${deuxChiffres(instant.getHours())}:${deuxChiffres(instant.getMinutes())}`
  );
}

/** L'heure locale du champ, rendue au contrat en ISO-8601. */
export function versIso(local: string): string {
  return new Date(local).toISOString();
}
