import type { Semeur } from './seeder';

/**
 * L'entité jouet du fil traceur (#6) : une Trace par Espace suffit à montrer,
 * dans l'interface, que chacun ne voit que les siennes et celles du Foyer.
 */
export const traces: Semeur = {
  module: 'traces',
  modeles: ['Trace'],
  espaces: ['PERSONAL', 'HOUSEHOLD'],
  async semer(prisma, demo) {
    const { count } = await prisma.trace.createMany({
      data: [
        {
          label: `Trace personnelle de ${demo.a.email}`,
          scopeId: demo.a.espacePersonnel,
        },
        {
          label: `Trace personnelle de ${demo.b.email}`,
          scopeId: demo.b.espacePersonnel,
        },
        { label: 'Trace du Foyer', scopeId: demo.espaceFoyer },
      ],
    });
    return count;
  },
};
