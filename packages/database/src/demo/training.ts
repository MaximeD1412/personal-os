import type { Prisma } from '../generated/prisma/client';
import type { Demo, Semeur } from './seeder';

type Saisie = Omit<Prisma.TrainingSessionCreateManyInput, 'scopeId'> & {
  espace: 'a' | 'b';
};

/*
 * Le jeu de démo du Sport : les jours autour du semis, dans l'Espace personnel
 * de chaque Compte. Il montre chaque statut (ADR 0022) : des Séances réalisées
 * contre leur prévu, une Séance manquée qui garde le sien, une sortie non
 * planifiée, née réalisée sans prévu, et des Séances encore prévues. Le passé
 * est réalisé ou manqué, l'avenir seulement prévu, comme le permet l'API.
 */
export function seancesDeDemo(
  demo: Demo,
): Prisma.TrainingSessionCreateManyInput[] {
  const espaces = { a: demo.a.espacePersonnel, b: demo.b.espacePersonnel };
  const seances: Saisie[] = [
    {
      espace: 'a',
      startsAt: demo.le(-6, '07:15'),
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
      sport: 'SWIM',
      status: 'MISSED',
      plannedDistanceM: 1_500,
      plannedDurationS: 1_800,
    },
    {
      espace: 'a',
      startsAt: demo.le(-2, '12:30'),
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
      sport: 'RUN',
      status: 'PLANNED',
      plannedDistanceM: 8_000,
      plannedIntent: 'Fractionné 6 × 800 m',
    },
    {
      espace: 'a',
      startsAt: demo.le(3, '09:00'),
      sport: 'RUN',
      status: 'PLANNED',
      plannedDistanceM: 18_000,
      plannedDurationS: 6_300,
      plannedIntent: 'Sortie longue',
    },
    {
      espace: 'b',
      startsAt: demo.le(-3, '18:00'),
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

/** Le semeur du module `training` : les Séances des deux Comptes. */
export const training: Semeur = {
  module: 'training',
  modeles: ['TrainingSession'],
  espaces: ['PERSONAL'],
  async semer(prisma, demo) {
    const { count } = await prisma.trainingSession.createMany({
      data: seancesDeDemo(demo),
    });
    return count;
  },
};
