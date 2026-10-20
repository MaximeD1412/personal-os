import type { ProjectExpenseInput, ProjectLink } from '@personal-os/contracts';
import { sousPortee } from '../lib/espace/portee';
import type { PrismaService } from '../lib/prisma.service';

/** Un Projet du jeu de démo, tel qu'on le saisirait, avec ses dépenses. */
export interface ProjetDeDemo {
  title: string;
  notes: string;
  links: ProjectLink[];
  expenses: ProjectExpenseInput[];
}

/**
 * Deux Projets personnels, avec des notes en markdown (titres, listes, cases
 * à cocher), des liens et quelques dépenses. Chaque Compte reçoit les deux,
 * dans son propre Espace personnel.
 */
export const PROJETS_DE_DEMO: readonly ProjetDeDemo[] = [
  {
    title: 'Atelier de reliure',
    notes: [
      '## Objectif',
      '',
      'Relier à la main les carnets de voyage de cette année, en **couture copte**.',
      '',
      '## Étapes',
      '',
      '- [x] Choisir le papier',
      '- [x] Plier et presser les cahiers',
      '- [ ] Coudre le premier carnet',
      '- [ ] Couvrir les plats en toile',
    ].join('\n'),
    links: [
      { label: 'La reliure', url: 'https://fr.wikipedia.org/wiki/Reliure' },
      {
        label: 'Couture copte',
        url: 'https://fr.wikipedia.org/wiki/Reliure_copte',
      },
    ],
    expenses: [
      {
        label: 'Presse à relier',
        amount: { cents: 8900, currency: 'EUR' },
        spentOn: '2026-09-14',
      },
      {
        label: 'Papier 120 g, 50 feuilles',
        amount: { cents: 2450, currency: 'EUR' },
        spentOn: '2026-09-20',
      },
      {
        label: 'Fil de lin ciré',
        amount: { cents: 790, currency: 'EUR' },
        spentOn: '2026-10-02',
      },
    ],
  },
  {
    title: 'Potager sur le balcon',
    notes: [
      '## Ce qui pousse',
      '',
      '- Tomates cerises, plein sud',
      '- Basilic et ciboulette, à mi-ombre',
      '',
      '> Arroser le soir, jamais en plein soleil.',
    ].join('\n'),
    links: [
      {
        label: 'Culture en bac',
        url: 'https://fr.wikipedia.org/wiki/Culture_en_conteneur',
      },
    ],
    expenses: [
      {
        label: 'Bacs de culture',
        amount: { cents: 5998, currency: 'EUR' },
        spentOn: '2026-04-11',
      },
      {
        label: 'Terreau, 40 L',
        amount: { cents: 1299, currency: 'EUR' },
        spentOn: '2026-04-11',
      },
      {
        label: 'Graines de tomates',
        amount: { cents: 450, currency: 'EUR' },
        spentOn: '2026-04-18',
      },
    ],
  },
];

/**
 * Le semeur des Projets : les deux Projets de démo dans l'Espace personnel de
 * chaque Compte. Chaque écriture se fait sous la portée de cet Espace, comme
 * une requête de son Compte : la garde s'applique au semis comme au reste.
 *
 * Il retrouve un Projet par son titre dans l'Espace, le remet dans l'état du
 * jeu et en remplace les dépenses : deux semis de suite donnent les mêmes
 * Projets. Le point d'entrée commun des semeurs est INFRA-6 : ce semeur s'y
 * branche tel quel.
 */
export async function semerLesProjets(prisma: PrismaService): Promise<void> {
  const espaces = await prisma.scope.findMany({
    where: { kind: 'PERSONAL' },
    select: { id: true },
  });

  for (const { id: scopeId } of espaces) {
    await sousPortee(
      {
        espaces: [{ id: scopeId, kind: 'PERSONAL' }],
        typesAcceptes: ['PERSONAL'],
      },
      async () => {
        for (const projet of PROJETS_DE_DEMO) {
          await semerUnProjet(prisma, scopeId, projet);
        }
      },
    );
  }
}

async function semerUnProjet(
  prisma: PrismaService,
  scopeId: string,
  { title, notes, links, expenses }: ProjetDeDemo,
): Promise<void> {
  const existant = await prisma.project.findFirst({ where: { title } });

  let projectId: string;
  if (existant) {
    projectId = existant.id;
    await prisma.project.update({
      where: { id: projectId },
      data: { notes, links },
    });
    await prisma.projectExpense.deleteMany({ where: { projectId } });
  } else {
    ({ id: projectId } = await prisma.project.create({
      data: { scopeId, title, notes, links },
    }));
  }

  await prisma.projectExpense.createMany({
    data: expenses.map(({ label, amount, spentOn }) => ({
      scopeId,
      projectId,
      label,
      amountCents: amount.cents,
      spentOn: new Date(`${spentOn}T00:00:00Z`),
    })),
  });
}
