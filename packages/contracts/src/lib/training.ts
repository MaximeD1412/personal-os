import * as z from 'zod';
import { zInstant, zPeriod } from './valeurs';

export const TRAINING_SPORTS = [
  'RUN',
  'BIKE',
  'SWIM',
  'STRENGTH',
  'OTHER',
] as const;

export const zTrainingSport = /* @__PURE__ */ z.enum(TRAINING_SPORTS);

export type TrainingSport = z.infer<typeof zTrainingSport>;

/** Le nom d'un sport, tel que l'écran et l'Agenda l'affichent. */
export const LIBELLES_DE_SPORT: Readonly<Record<TrainingSport, string>> = {
  RUN: 'Course à pied',
  BIKE: 'Vélo',
  SWIM: 'Natation',
  STRENGTH: 'Renforcement',
  OTHER: 'Autre',
};

/**
 * Où en est une Séance (ADR 0022). Il n'y a pas d'objet « résultat » : une
 * Séance prévue devient réalisée ou manquée, et garde son prévu dans les deux
 * cas.
 */
export const zTrainingSessionStatus = /* @__PURE__ */ z.enum([
  'PLANNED',
  'DONE',
  'MISSED',
]);

export type TrainingSessionStatus = z.infer<typeof zTrainingSessionStatus>;

/** Une distance, en mètres entiers. */
const zDistanceM = /* @__PURE__ */ z.int().min(1);

/** Une durée, en secondes entières. L'allure se calcule à l'affichage. */
const zDurationS = /* @__PURE__ */ z.int().min(1);

const zTexte = /* @__PURE__ */ z.string().trim().min(1);

/** Les champs du prévu, dans l'ordre où l'écran les compare au réalisé. */
export const CHAMPS_DU_PREVU = [
  'plannedDistanceM',
  'plannedDurationS',
  'plannedIntent',
] as const;

/** Les champs du réalisé. */
export const CHAMPS_DU_REALISE = [
  'actualDistanceM',
  'actualDurationS',
  'actualNotes',
] as const;

/**
 * Une Séance : le prévu **et** le réalisé sur le même objet, plus un statut
 * (ADR 0022). L'écart se lit champ par champ, sans jointure. Le sport est
 * personnel : l'Espace est toujours l'Espace personnel du Compte.
 */
export const zTrainingSession = /* @__PURE__ */ z.object({
  id: /* @__PURE__ */ z.string(),
  startsAt: zInstant,
  sport: zTrainingSport,
  status: zTrainingSessionStatus,
  plannedDistanceM: /* @__PURE__ */ zDistanceM.nullable(),
  plannedDurationS: /* @__PURE__ */ zDurationS.nullable(),
  plannedIntent: /* @__PURE__ */ z.string().nullable(),
  actualDistanceM: /* @__PURE__ */ zDistanceM.nullable(),
  actualDurationS: /* @__PURE__ */ zDurationS.nullable(),
  actualNotes: /* @__PURE__ */ z.string().nullable(),
  /** L'Objectif que la Séance prépare (SPORT-2). */
  goalId: /* @__PURE__ */ z.string().nullable(),
  scopeId: /* @__PURE__ */ z.string(),
  createdAt: zInstant,
});

export type TrainingSession = z.infer<typeof zTrainingSession>;

/**
 * Les champs d'une création, sans les règles qui les lient. Le formulaire s'en
 * sert pour se préremplir champ par champ (ADR 0030).
 *
 * Pas d'Espace : le Sport n'accepte que l'Espace personnel, et le Compte n'en
 * atteint qu'un. C'est le module qui le pose (ADR 0030).
 */
export const zTrainingSessionInputFields = /* @__PURE__ */ z.object({
  startsAt: zInstant,
  sport: zTrainingSport,
  /** Une Séance naît prévue, ou déjà réalisée : jamais manquée. */
  status: /* @__PURE__ */ z.enum(['PLANNED', 'DONE']),
  plannedDistanceM: zDistanceM.optional(),
  plannedDurationS: zDurationS.optional(),
  plannedIntent: zTexte.optional(),
  actualDistanceM: zDistanceM.optional(),
  actualDurationS: zDurationS.optional(),
  actualNotes: zTexte.optional(),
});

/**
 * Une création : une Séance prévue porte son prévu et rien de réalisé ; une
 * sortie non planifiée naît réalisée, avec son réalisé et sans prévu
 * (ADR 0022). Le statut décide des champs admis : c'est une question de
 * forme, refusée en 400 sur le champ qui la viole.
 */
export const zTrainingSessionInput =
  /* @__PURE__ */ zTrainingSessionInputFields.superRefine((saisie, ctx) => {
    const [admis, refuses, message] =
      saisie.status === 'PLANNED'
        ? ([
            CHAMPS_DU_PREVU,
            CHAMPS_DU_REALISE,
            "Une Séance prévue n'a pas encore de réalisé.",
          ] as const)
        : ([
            CHAMPS_DU_REALISE,
            CHAMPS_DU_PREVU,
            "Une sortie non planifiée n'a pas de prévu.",
          ] as const);

    for (const champ of refuses) {
      if (saisie[champ] !== undefined) {
        ctx.addIssue({ code: 'custom', path: [champ], message });
      }
    }
    if (admis.every((champ) => saisie[champ] === undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: [admis[0]],
        message:
          saisie.status === 'PLANNED'
            ? 'Une Séance prévue porte une distance, une durée ou une intention.'
            : 'Une Séance réalisée porte une distance, une durée ou des notes.',
      });
    }
  });

export type TrainingSessionInput = z.infer<typeof zTrainingSessionInput>;

/**
 * Une modification porte le prévu et le réalisé, **jamais le statut** : il ne
 * change que par `complete` et `miss` (ADR 0030). Un champ nommé vide est
 * retiré. Que le réalisé n'aille qu'à une Séance réalisée dépend de ce qui est
 * en base : c'est une règle métier, que le service juge.
 */
export const zTrainingSessionUpdate = /* @__PURE__ */ z.object({
  startsAt: zInstant.optional(),
  sport: zTrainingSport.optional(),
  plannedDistanceM: zDistanceM.nullable().optional(),
  plannedDurationS: zDurationS.nullable().optional(),
  plannedIntent: zTexte.nullable().optional(),
  actualDistanceM: zDistanceM.nullable().optional(),
  actualDurationS: zDurationS.nullable().optional(),
  actualNotes: zTexte.nullable().optional(),
});

export type TrainingSessionUpdate = z.infer<typeof zTrainingSessionUpdate>;

/** Ce qu'on déclare en marquant une Séance réalisée : au moins une valeur. */
export const zTrainingSessionCompletion = /* @__PURE__ */ z
  .object({
    actualDistanceM: zDistanceM.optional(),
    actualDurationS: zDurationS.optional(),
    actualNotes: zTexte.optional(),
  })
  .refine(
    (realise) => CHAMPS_DU_REALISE.some((champ) => realise[champ] !== undefined),
    {
      path: ['actualDistanceM'],
      error: 'Une Séance réalisée porte une distance, une durée ou des notes.',
    },
  );

export type TrainingSessionCompletion = z.infer<
  typeof zTrainingSessionCompletion
>;

/** Les Séances se lisent sur une période obligatoire : celles qui y commencent. */
export const zTrainingSessionListQuery = zPeriod;

export type TrainingSessionListQuery = z.infer<
  typeof zTrainingSessionListQuery
>;

/** La source du Sport dans l'Agenda. */
export const SOURCE_SPORT = 'training';

/**
 * Une Séance n'a pas de titre : on la nomme par son sport, et par son
 * intention quand elle en a une. L'Agenda et l'écran la nomment pareil.
 */
export function titreDeSeance(
  seance: Pick<TrainingSession, 'sport' | 'plannedIntent'>,
): string {
  const sport = LIBELLES_DE_SPORT[seance.sport];
  return seance.plannedIntent ? `${sport} · ${seance.plannedIntent}` : sport;
}
