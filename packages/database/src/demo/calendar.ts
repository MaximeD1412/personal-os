import type { Prisma } from '../generated/prisma/client';
import type { Demo, Semeur } from './semeur';

type Saisie = Omit<Prisma.EventUncheckedCreateInput, 'scopeId'> & {
  espace: 'a' | 'b' | 'foyer';
};

/**
 * Une dizaine d'Événements sur les quatre semaines autour d'aujourd'hui, dans
 * les trois Espaces, chacun avec au moins une Échéance.
 */
function evenements(demo: Demo): Saisie[] {
  return [
    {
      espace: 'foyer',
      title: 'Dîner chez les parents',
      startsAt: demo.le(-10, '19:30'),
      endsAt: demo.le(-10, '23:00'),
      category: 'OTHER',
    },
    {
      espace: 'foyer',
      title: 'Anniversaire de Léa',
      startsAt: demo.le(-3, '00:00'),
      category: 'BIRTHDAY',
      reminderLeadMinutes: 7 * 24 * 60,
    },
    {
      espace: 'foyer',
      title: 'Déclaration de la taxe foncière',
      startsAt: demo.le(2, '18:00'),
      category: 'DEADLINE',
      reminderLeadMinutes: 24 * 60,
    },
    {
      espace: 'foyer',
      title: 'Week-end à la mer',
      startsAt: demo.le(6, '09:00'),
      endsAt: demo.le(8, '18:00'),
      category: 'OTHER',
    },
    {
      espace: 'foyer',
      title: 'Passage du plombier',
      startsAt: demo.le(12, '08:30'),
      endsAt: demo.le(12, '10:00'),
      category: 'APPOINTMENT',
      reminderLeadMinutes: 60,
    },
    {
      espace: 'a',
      title: 'Dentiste',
      startsAt: demo.le(-7, '09:30'),
      endsAt: demo.le(-7, '10:15'),
      category: 'APPOINTMENT',
    },
    {
      espace: 'a',
      title: 'Appel avec la banque',
      startsAt: demo.le(0, '14:00'),
      endsAt: demo.le(0, '14:30'),
      category: 'APPOINTMENT',
      reminderLeadMinutes: 30,
    },
    {
      espace: 'a',
      title: 'Renouveler le passeport',
      startsAt: demo.le(9, '12:00'),
      category: 'DEADLINE',
      reminderLeadMinutes: 3 * 24 * 60,
    },
    {
      espace: 'b',
      title: "Séance chez l'ostéopathe",
      startsAt: demo.le(-5, '18:00'),
      endsAt: demo.le(-5, '19:00'),
      category: 'APPOINTMENT',
    },
    {
      espace: 'b',
      title: 'Rendu du dossier de candidature',
      startsAt: demo.le(1, '23:59'),
      category: 'DEADLINE',
      reminderLeadMinutes: 24 * 60,
    },
    {
      espace: 'b',
      title: 'Concert',
      startsAt: demo.le(13, '20:30'),
      endsAt: demo.le(13, '23:00'),
      category: 'OTHER',
    },
  ];
}

export const calendar: Semeur = {
  module: 'calendar',
  modeles: ['Event'],
  espaces: ['PERSONAL', 'HOUSEHOLD'],
  async semer(prisma, demo) {
    const espaces = {
      a: demo.a.espacePersonnel,
      b: demo.b.espacePersonnel,
      foyer: demo.espaceFoyer,
    };
    const { count } = await prisma.event.createMany({
      data: evenements(demo).map(({ espace, ...evenement }) => ({
        ...evenement,
        scopeId: espaces[espace],
      })),
    });
    return count;
  },
};
