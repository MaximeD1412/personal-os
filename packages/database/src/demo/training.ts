import type { Prisma } from '../generated/prisma/client';
import { decalerLeJour } from './dates';
import type { Demo, Semeur } from './seeder';

/** Les Objectifs du jeu, par une clé que leurs Séances citent. */
type CleDObjectif = 'semi' | 'triathlon' | 'lac';

type Saisie = Omit<
  Prisma.TrainingSessionCreateManyInput,
  'scopeId' | 'goalId'
> & {
  espace: 'a' | 'b';
  objectif?: CleDObjectif;
};

/** Un Objectif de démo, avant que le semis ne lui donne son identifiant. */
export interface ObjectifDeDemo {
  cle: CleDObjectif;
  scopeId: string;
  title: string;
  date: Date;
  intent: string | null;
}

/** Une Séance de démo, qui cite son Objectif par sa clé. */
export type SeanceDeDemo = Prisma.TrainingSessionCreateManyInput & {
  objectif?: CleDObjectif;
};

/** Un jour (`YYYY-MM-DD`) tel que Prisma l'écrit dans une colonne `date`. */
const enDate = (jour: string): Date => new Date(`${jour}T00:00:00.000Z`);

/*
 * Les Objectifs : un semi-marathon dans cinq semaines vers lequel mènent la
 * plupart des Séances du Compte a, un triathlon lointain encore sans Séance,
 * et la traversée d'un lac pour le Compte b.
 */
export function objectifsDeDemo(demo: Demo): ObjectifDeDemo[] {
  const jour = (decalage: number) =>
    enDate(decalerLeJour(demo.aujourdhui, decalage));

  return [
    {
      cle: 'semi',
      scopeId: demo.a.espacePersonnel,
      title: 'Semi-marathon de Lyon',
      date: jour(38),
      intent: 'Passer sous 1 h 45',
    },
    {
      cle: 'triathlon',
      scopeId: demo.a.espacePersonnel,
      title: 'Triathlon de Nice',
      date: jour(200),
      intent: null,
    },
    {
      cle: 'lac',
      scopeId: demo.b.espacePersonnel,
      title: "Traversée du lac d'Annecy",
      date: jour(60),
      intent: 'Nager 3 km sans pause',
    },
  ];
}

/*
 * Le jeu de démo du Sport : les jours autour du semis, dans l'Espace personnel
 * de chaque Compte. Il montre chaque statut (ADR 0022) : des Séances réalisées
 * contre leur prévu, une Séance manquée qui garde le sien, une sortie non
 * planifiée, née réalisée sans prévu, et des Séances encore prévues. Le passé
 * est réalisé ou manqué, l'avenir seulement prévu, comme le permet l'API.
 * La plupart mènent à un Objectif ; la sortie imprévue n'en sert aucun.
 */
export function seancesDeDemo(demo: Demo): SeanceDeDemo[] {
  const espaces = { a: demo.a.espacePersonnel, b: demo.b.espacePersonnel };
  const seances: Saisie[] = [
    {
      espace: 'a',
      startsAt: demo.le(-6, '07:15'),
      objectif: 'semi',
      sport: 'RUN',
      status: 'DONE',
      plannedDistanceM: 10_000,
      plannedDurationS: 3_600,
      plannedIntent: 'Footing',
      actualDistanceM: 11_200,
      actualDurationS: 3_840,
      actualNotes: 'Bonnes jambes',
    },
    {
      espace: 'a',
      startsAt: demo.le(-4, '18:30'),
      objectif: 'semi',
      sport: 'SWIM',
      status: 'MISSED',
      plannedDistanceM: 1_500,
      plannedDurationS: 1_800,
    },
    {
      espace: 'a',
      startsAt: demo.le(-2, '12:30'),
      objectif: 'semi',
      sport: 'STRENGTH',
      status: 'DONE',
      plannedDurationS: 2_700,
      plannedIntent: 'Gainage',
      actualDurationS: 2_400,
    },
    {
      espace: 'a',
      startsAt: demo.le(-1, '19:00'),
      sport: 'BIKE',
      status: 'DONE',
      actualDistanceM: 32_000,
      actualDurationS: 4_500,
      actualNotes: 'Sortie imprévue avec le club',
    },
    {
      espace: 'a',
      startsAt: demo.le(1, '07:15'),
      objectif: 'semi',
      sport: 'RUN',
      status: 'PLANNED',
      plannedDistanceM: 8_000,
      plannedIntent: 'Fractionné 6 × 800 m',
    },
    {
      espace: 'a',
      startsAt: demo.le(3, '09:00'),
      objectif: 'semi',
      sport: 'RUN',
      status: 'PLANNED',
      plannedDistanceM: 18_000,
      plannedDurationS: 6_300,
      plannedIntent: 'Sortie longue',
    },
    {
      espace: 'b',
      startsAt: demo.le(-3, '18:00'),
      objectif: 'lac',
      sport: 'SWIM',
      status: 'DONE',
      plannedDistanceM: 2_000,
      actualDistanceM: 2_000,
      actualDurationS: 2_700,
    },
    {
      espace: 'b',
      startsAt: demo.le(2, '10:00'),
      sport: 'OTHER',
      status: 'PLANNED',
      plannedDurationS: 3_600,
      plannedIntent: 'Yoga',
    },
  ];

  return seances.map(({ espace, ...seance }) => ({
    ...seance,
    scopeId: espaces[espace],
  }));
}

/**
 * Le semeur du module `training` : les Objectifs des deux Comptes, puis leurs
 * Séances, liées par l'identifiant que chaque Objectif vient de recevoir.
 */
export const training: Semeur = {
  module: 'training',
  modeles: ['TrainingGoal', 'TrainingSession'],
  espaces: ['PERSONAL'],
  async semer(prisma, demo) {
    const ids = new Map<CleDObjectif, string>();
    for (const { cle, ...objectif } of objectifsDeDemo(demo)) {
      const { id } = await prisma.trainingGoal.create({ data: objectif });
      ids.set(cle, id);
    }

    const { count } = await prisma.trainingSession.createMany({
      data: seancesDeDemo(demo).map(({ objectif, ...seance }) => ({
        ...seance,
        goalId: objectif ? ids.get(objectif) : null,
      })),
    });
    return ids.size + count;
  },
};
