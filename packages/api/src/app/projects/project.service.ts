import { Injectable } from '@nestjs/common';
import {
  totalDesDepenses,
  type Project,
  type ProjectExpense,
  type ProjectExpenseInput,
  type ProjectInput,
  type ProjectSummary,
  type ProjectUpdate,
} from '@personal-os/contracts';
import { espacePersonnelCourant } from '../espace/espace-personnel';
import { ErreurMetier, Introuvable } from '../erreurs/erreur-metier';
import {
  ProjectRepository,
  type ProjectExpenseRecord,
  type ProjectRecord,
  type ProjectWrite,
} from './project.repository';

/**
 * Les saisies arrivent validées par leur schéma (ADR 0030) : il ne reste ici
 * qu'un Projet introuvable — absent, ou de l'autre Compte, la garde ne le
 * laisse pas voir —, une dépense qui n'est pas de ce Projet, et une
 * modification vide.
 */
@Injectable()
export class ProjectService {
  constructor(private readonly repository: ProjectRepository) {}

  async lister(): Promise<ProjectSummary[]> {
    const projets = await this.repository.lister();
    const depenses = await this.repository.depensesDe(
      projets.map(({ id }) => id),
    );

    return projets.map((projet) => ({
      id: projet.id,
      scopeId: projet.scopeId,
      title: projet.title,
      totalSpent: totalDe(depenses.filter((d) => d.projectId === projet.id)),
      updatedAt: projet.updatedAt.toISOString(),
    }));
  }

  async lire(id: string): Promise<Project> {
    return this.complet(await this.existant(id));
  }

  /** Un Projet vit dans l'Espace personnel de son Compte : le module le pose. */
  async creer(saisie: ProjectInput): Promise<Project> {
    return this.complet(
      await this.repository.creer(espacePersonnelCourant(), saisie),
    );
  }

  async modifier(id: string, saisie: ProjectUpdate): Promise<Project> {
    const changements = enChangements(saisie);

    if (Object.keys(changements).length === 0) {
      throw new ErreurMetier(
        'project.empty_update',
        'La modification ne change rien.',
      );
    }

    await this.existant(id);
    return this.complet(
      await introuvableSinon(this.repository.modifier(id, changements)),
    );
  }

  async supprimer(id: string): Promise<void> {
    await this.existant(id);
    await introuvableSinon(this.repository.supprimer(id));
  }

  async ajouterUneDepense(
    id: string,
    saisie: ProjectExpenseInput,
  ): Promise<ProjectExpense> {
    const projet = await this.existant(id);

    return exposerLaDepense(
      await introuvableSinon(
        this.repository.ajouterUneDepense(projet, {
          label: saisie.label,
          amountCents: saisie.amount.cents,
          spentOn: saisie.spentOn,
        }),
      ),
    );
  }

  async retirerUneDepense(id: string, expenseId: string): Promise<void> {
    await this.existant(id);

    if (!(await this.repository.retirerUneDepense(id, expenseId))) {
      throw new Introuvable(
        'project.expense_not_found',
        'Aucune dépense de cet identifiant dans ce Projet.',
      );
    }
  }

  private async existant(id: string): Promise<ProjectRecord> {
    const projet = await this.repository.lire(id);
    if (!projet) {
      throw projetIntrouvable();
    }
    return projet;
  }

  private async complet(projet: ProjectRecord): Promise<Project> {
    const depenses = await this.repository.depensesDe([projet.id]);

    return {
      id: projet.id,
      scopeId: projet.scopeId,
      title: projet.title,
      notes: projet.notes,
      links: projet.links,
      expenses: depenses.map(exposerLaDepense),
      totalSpent: totalDe(depenses),
      createdAt: projet.createdAt.toISOString(),
      updatedAt: projet.updatedAt.toISOString(),
    };
  }
}

function projetIntrouvable(): Introuvable {
  return new Introuvable(
    'project.not_found',
    'Aucun Projet de cet identifiant.',
  );
}

/**
 * Entre la lecture et l'écriture, le Projet peut avoir été supprimé : la base
 * le dit (P2025 pour une rangée absente, P2003 pour une clé étrangère qui ne
 * mène plus nulle part), et c'est le même 404.
 */
async function introuvableSinon<T>(operation: Promise<T>): Promise<T> {
  try {
    return await operation;
  } catch (erreur) {
    const code =
      typeof erreur === 'object' && erreur !== null && 'code' in erreur
        ? erreur.code
        : undefined;
    if (code === 'P2025' || code === 'P2003') {
      throw projetIntrouvable();
    }
    throw erreur;
  }
}

function totalDe(depenses: readonly ProjectExpenseRecord[]) {
  return totalDesDepenses(
    depenses.map(({ amountCents }) => ({
      cents: amountCents,
      currency: 'EUR' as const,
    })),
  );
}

/** Une modification ne porte que ce qu'elle change. */
function enChangements(saisie: ProjectUpdate): Partial<ProjectWrite> {
  const changements: Partial<ProjectWrite> = {};

  if (saisie.title !== undefined) {
    changements.title = saisie.title;
  }
  if (saisie.notes !== undefined) {
    changements.notes = saisie.notes;
  }
  if (saisie.links !== undefined) {
    changements.links = saisie.links;
  }

  return changements;
}

function exposerLaDepense(depense: ProjectExpenseRecord): ProjectExpense {
  return {
    id: depense.id,
    projectId: depense.projectId,
    label: depense.label,
    amount: { cents: depense.amountCents, currency: 'EUR' },
    spentOn: depense.spentOn,
    createdAt: depense.createdAt.toISOString(),
  };
}
