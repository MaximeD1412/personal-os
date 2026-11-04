import type { TrainingGoalProgress } from '@personal-os/contracts';

/** Ce que l'écran affiche de l'avancement d'un Objectif. */
export interface Avancement {
  faites: number;
  /** Toutes les Séances qui mènent à l'Objectif, quel que soit leur statut. */
  total: number;
  /** La part des Séances faites, arrondie ; 0 sans aucune Séance. */
  pourcentage: number;
  /** « 3 / 6 faites ». */
  libelle: string;
  /** « 1 manquée · 2 à venir ». */
  detail: string;
}

/**
 * L'avancement se lit sur les Séances liées : les faites sur l'ensemble,
 * manquées et à venir comprises. Rien ne se stocke de plus (ADR 0022).
 */
export function avancementDe({
  done,
  missed,
  planned,
}: TrainingGoalProgress): Avancement {
  const total = done + missed + planned;
  if (total === 0) {
    return {
      faites: 0,
      total: 0,
      pourcentage: 0,
      libelle: 'Aucune séance',
      detail: 'Aucune séance planifiée',
    };
  }

  return {
    faites: done,
    total,
    pourcentage: Math.round((done / total) * 100),
    libelle: `${done} / ${total} faites`,
    detail: `${missed} ${missed > 1 ? 'manquées' : 'manquée'} · ${planned} à venir`,
  };
}

const JOUR_MS = 86_400_000;

/**
 * Le temps qui reste avant l'Objectif, en jours civils : deux jours (`zDay`)
 * se comparent à minuit UTC, où aucun changement d'heure ne les décale.
 */
export function echeanceDe(
  date: string,
  aujourdhui: string,
): { libelle: string; passee: boolean } {
  const jours = Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${aujourdhui}T00:00:00Z`)) /
      JOUR_MS,
  );
  if (jours < 0) {
    return { libelle: 'Passé', passee: true };
  }
  const libelle =
    jours === 0
      ? "Aujourd'hui"
      : jours === 1
        ? 'Demain'
        : `Dans ${jours} jours`;
  return { libelle, passee: false };
}
