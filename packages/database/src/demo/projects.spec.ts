import { zProjectExpenseInput, zProjectInput } from '@personal-os/contracts';
import { porteeCourante } from '../lib/espace/portee';
import type { PrismaService } from '../lib/prisma.service';
import { PROJETS_DE_DEMO, semerLesProjets } from './projects';

const ESPACE_A = 'espace-personnel-a';
const ESPACE_B = 'espace-personnel-b';

/**
 * Un Prisma factice qui note, pour chaque écriture, la portée sous laquelle
 * elle a été faite : la garde d'Espace refuserait une création hors de
 * l'Espace qu'elle nomme.
 */
function prismaFactice(existants: Record<string, string> = {}) {
  const ecritures: { geste: string; scopeId?: string; portee: unknown }[] = [];
  const noter =
    (geste: string) =>
    (args: { data?: { scopeId?: string } | { scopeId?: string }[] }) => {
      const data = Array.isArray(args.data) ? args.data[0] : args.data;
      ecritures.push({
        geste,
        scopeId: data?.scopeId,
        portee: porteeCourante(),
      });
      return Promise.resolve({ id: `projet-${ecritures.length}`, count: 0 });
    };

  const prisma = {
    scope: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: ESPACE_A }, { id: ESPACE_B }]),
    },
    project: {
      findFirst: jest.fn(({ where }: { where: { title: string } }) => {
        const scopeId = porteeCourante()?.espaces[0]?.id ?? '';
        const id = existants[`${scopeId}/${where.title}`];
        return Promise.resolve(id ? { id, scopeId } : null);
      }),
      create: jest.fn(noter('project.create')),
      update: jest.fn(noter('project.update')),
    },
    projectExpense: {
      deleteMany: jest.fn(noter('projectExpense.deleteMany')),
      createMany: jest.fn(noter('projectExpense.createMany')),
    },
  };

  return {
    prisma: prisma as unknown as PrismaService,
    mock: prisma,
    ecritures,
  };
}

describe('Les Projets de démo', () => {
  it('sont deux, chacun conforme à la saisie du contrat, dépenses comprises', () => {
    expect(PROJETS_DE_DEMO).toHaveLength(2);
    for (const { expenses, ...projet } of PROJETS_DE_DEMO) {
      expect(zProjectInput.safeParse(projet).success).toBe(true);
      expect(expenses.length).toBeGreaterThan(0);
      for (const depense of expenses) {
        expect(zProjectExpenseInput.safeParse(depense).success).toBe(true);
      }
    }
  });
});

describe('semerLesProjets', () => {
  it("crée deux Projets dans l'Espace personnel de chaque Compte, sous sa portée", async () => {
    const { prisma, mock, ecritures } = prismaFactice();

    await semerLesProjets(prisma);

    expect(mock.scope.findMany).toHaveBeenCalledWith({
      where: { kind: 'PERSONAL' },
      select: { id: true },
    });
    const creations = ecritures.filter(
      ({ geste }) => geste === 'project.create',
    );
    expect(creations.map(({ scopeId }) => scopeId)).toEqual([
      ESPACE_A,
      ESPACE_A,
      ESPACE_B,
      ESPACE_B,
    ]);
    for (const { scopeId, portee } of ecritures) {
      expect(portee).toEqual({
        espaces: [{ id: scopeId, kind: 'PERSONAL' }],
        typesAcceptes: ['PERSONAL'],
      });
    }
    expect(mock.projectExpense.createMany).toHaveBeenCalledTimes(4);
  });

  it('remet un Projet déjà semé dans son état, sans en doubler les dépenses', async () => {
    const [premier] = PROJETS_DE_DEMO;
    const { prisma, mock } = prismaFactice({
      [`${ESPACE_A}/${premier.title}`]: 'deja-seme',
    });

    await semerLesProjets(prisma);

    expect(mock.project.update).toHaveBeenCalledTimes(1);
    expect(mock.project.update).toHaveBeenCalledWith({
      where: { id: 'deja-seme' },
      data: { notes: premier.notes, links: premier.links },
    });
    expect(mock.projectExpense.deleteMany).toHaveBeenCalledWith({
      where: { projectId: 'deja-seme' },
    });
    expect(mock.project.create).toHaveBeenCalledTimes(3);
  });
});
