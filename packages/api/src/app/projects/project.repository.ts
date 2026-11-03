import { Injectable } from '@nestjs/common';
import type { ProjectLink } from '@personal-os/contracts';
import { PrismaService } from '@personal-os/database';

export interface ProjectRecord {
  id: string;
  scopeId: string;
  title: string;
  notes: string;
  links: ProjectLink[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectWrite {
  title: string;
  notes: string;
  links: ProjectLink[];
}

export interface ProjectExpenseRecord {
  id: string;
  projectId: string;
  label: string;
  amountCents: number;
  /** Un jour civil, `YYYY-MM-DD` : la colonne est une `date`, sans heure. */
  spentOn: string;
  createdAt: Date;
}

export interface ProjectExpenseWrite {
  label: string;
  amountCents: number;
  spentOn: string;
}

/**
 * `Project` et `ProjectExpense` portent leur Espace : la garde borne chaque
 * lecture à la portée de la requête, et refuse une création hors de celle-ci.
 * Les dépenses se lisent au premier niveau, jamais par un `include` que la
 * garde ne filtrerait pas.
 */
@Injectable()
export class ProjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  async lister(): Promise<ProjectRecord[]> {
    const rangees = await this.prisma.project.findMany({
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });

    return rangees.map(enProjet);
  }

  async lire(id: string): Promise<ProjectRecord | null> {
    const rangee = await this.prisma.project.findUnique({ where: { id } });

    return rangee ? enProjet(rangee) : null;
  }

  async creer(scopeId: string, saisie: ProjectWrite): Promise<ProjectRecord> {
    return enProjet(
      await this.prisma.project.create({ data: { scopeId, ...saisie } }),
    );
  }

  async modifier(
    id: string,
    saisie: Partial<ProjectWrite>,
  ): Promise<ProjectRecord> {
    return enProjet(
      await this.prisma.project.update({ where: { id }, data: saisie }),
    );
  }

  /** Supprime le Projet et, par la clé étrangère, ses dépenses. */
  async supprimer(id: string): Promise<void> {
    await this.prisma.project.delete({ where: { id } });
  }

  /** Les dépenses de ces Projets, de la plus récente à la plus ancienne. */
  async depensesDe(
    projectIds: readonly string[],
  ): Promise<ProjectExpenseRecord[]> {
    const rangees = await this.prisma.projectExpense.findMany({
      where: { projectId: { in: [...projectIds] } },
      orderBy: [{ spentOn: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
    });

    return rangees.map(enDepense);
  }

  /** Ajoute une dépense au Projet, dans l'Espace du Projet. */
  async ajouterUneDepense(
    projet: Pick<ProjectRecord, 'id' | 'scopeId'>,
    saisie: ProjectExpenseWrite,
  ): Promise<ProjectExpenseRecord> {
    return enDepense(
      await this.prisma.projectExpense.create({
        data: {
          scopeId: projet.scopeId,
          projectId: projet.id,
          label: saisie.label,
          amountCents: saisie.amountCents,
          spentOn: enMinuitUtc(saisie.spentOn),
        },
      }),
    );
  }

  /** Retire la dépense si elle est bien de ce Projet ; dit si elle l'était. */
  async retirerUneDepense(projectId: string, id: string): Promise<boolean> {
    const { count } = await this.prisma.projectExpense.deleteMany({
      where: { id, projectId },
    });

    return count > 0;
  }
}

interface RangeeProjet extends Omit<ProjectRecord, 'links'> {
  links: unknown;
}

/** Les liens sont validés par leur schéma avant d'être écrits : on les relit tels quels. */
function enProjet(rangee: RangeeProjet): ProjectRecord {
  return {
    id: rangee.id,
    scopeId: rangee.scopeId,
    title: rangee.title,
    notes: rangee.notes,
    links: rangee.links as ProjectLink[],
    createdAt: rangee.createdAt,
    updatedAt: rangee.updatedAt,
  };
}

function enDepense(rangee: {
  id: string;
  projectId: string;
  label: string;
  amountCents: number;
  spentOn: Date;
  createdAt: Date;
}): ProjectExpenseRecord {
  return {
    id: rangee.id,
    projectId: rangee.projectId,
    label: rangee.label,
    amountCents: rangee.amountCents,
    spentOn: rangee.spentOn.toISOString().slice(0, 10),
    createdAt: rangee.createdAt,
  };
}

// Une colonne `date` reçoit un instant : minuit UTC le garde sur son jour.
function enMinuitUtc(jour: string): Date {
  return new Date(`${jour}T00:00:00Z`);
}
