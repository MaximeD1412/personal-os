import {
  CHAMPS_DU_PREVU,
  CHAMPS_DU_REALISE,
  type TrainingSession,
  type TrainingSessionCompletion,
  type TrainingSessionUpdate,
} from '@personal-os/contracts';
import { ErreurMetier } from '../erreurs/erreur-metier';

/** Ce dont les règles ont besoin d'une Séance : son statut, son prévu, son réalisé. */
export type EtatDeSeance = Pick<
  TrainingSession,
  'status' | (typeof CHAMPS_DU_PREVU)[number] | (typeof CHAMPS_DU_REALISE)[number]
>;

/** Ce qu'une transition écrit : le statut et, pour « réalisée », le réalisé. */
export type Transition = Partial<
  Pick<TrainingSession, 'status' | (typeof CHAMPS_DU_REALISE)[number]>
>;

/**
 * Les règles de vie d'une Séance (ADR 0022) : un seul objet porte le prévu et
 * le réalisé, et le statut ne bouge que par une transition.
 *
 * - une Séance prévue devient réalisée (`complete`) ou manquée (`miss`), et
 *   garde son prévu dans les deux cas ;
 * - une Séance réalisée ou manquée ne change plus de statut ;
 * - le réalisé n'appartient qu'à une Séance réalisée : une Séance prévue le
 *   reçoit en devenant réalisée, une Séance manquée reste sans.
 */
export function completer(
  seance: EtatDeSeance,
  realise: TrainingSessionCompletion,
): Transition {
  verifierQuElleEstPrevue(seance);

  return {
    status: 'DONE',
    actualDistanceM: realise.actualDistanceM ?? null,
    actualDurationS: realise.actualDurationS ?? null,
    actualNotes: realise.actualNotes ?? null,
  };
}

/** Manquée, une Séance garde son prévu : seul le statut change. */
export function manquer(seance: EtatDeSeance): Transition {
  verifierQuElleEstPrevue(seance);

  return { status: 'MISSED' };
}

/**
 * Une modification porte le prévu et le réalisé, jamais le statut. Elle rend
 * les champs à écrire, après avoir jugé la Séance qu'elle laisserait.
 */
export function modifier(
  seance: EtatDeSeance,
  changements: TrainingSessionUpdate,
): TrainingSessionUpdate {
  const ecrits = Object.fromEntries(
    Object.entries(changements).filter(([, valeur]) => valeur !== undefined),
  ) as TrainingSessionUpdate;

  if (Object.keys(ecrits).length === 0) {
    throw new ErreurMetier(
      'training.empty_update',
      'La modification ne change rien.',
    );
  }

  const apres = { ...seance, ...ecrits };

  if (seance.status !== 'DONE' && porteUnDes(ecrits, CHAMPS_DU_REALISE)) {
    throw new ErreurMetier(
      'training.actual_requires_done',
      "Le réalisé ne se saisit que sur une Séance réalisée : marquez-la réalisée d'abord.",
    );
  }
  if (seance.status !== 'DONE' && !porteUnDes(apres, CHAMPS_DU_PREVU)) {
    throw new ErreurMetier(
      'training.planned_required',
      'Une Séance prévue garde une distance, une durée ou une intention.',
    );
  }
  if (seance.status === 'DONE' && !porteUnDes(apres, CHAMPS_DU_REALISE)) {
    throw new ErreurMetier(
      'training.actual_required',
      'Une Séance réalisée garde une distance, une durée ou des notes.',
    );
  }

  return ecrits;
}

function verifierQuElleEstPrevue(seance: EtatDeSeance): void {
  if (seance.status === 'DONE') {
    throw new ErreurMetier(
      'training.already_done',
      'Cette Séance est déjà réalisée.',
    );
  }
  if (seance.status === 'MISSED') {
    throw new ErreurMetier(
      'training.already_missed',
      'Cette Séance est déjà manquée.',
    );
  }
}

function porteUnDes(
  valeurs: Partial<Record<string, unknown>>,
  champs: readonly string[],
): boolean {
  return champs.some(
    (champ) => valeurs[champ] !== undefined && valeurs[champ] !== null,
  );
}
