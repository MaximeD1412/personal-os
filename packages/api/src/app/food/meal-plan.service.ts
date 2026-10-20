import { Injectable } from '@nestjs/common';
import {
  portions,
  type MealPlan,
  type MealPlanEntry,
  type MealPlanEntryInput,
  type MealPlanEntryUpdate,
  type MealPlanQuery,
} from '@personal-os/contracts';
import { ErreurMetier, Introuvable } from '../erreurs/erreur-metier';
import {
  MealPlanRepository,
  type MealPlanEntryRecord,
  type MealPlanEntryWrite,
  type MealPlanRecord,
} from './meal-plan.repository';
import { estDansLaSemaine } from './planning/semaine';

/**
 * Les saisies arrivent validées par leur schéma (ADR 0030) : il reste ici ce
 * qu'un schéma ne peut pas juger seul. Un jour hors de la semaine, des
 * Participants absents ou étrangers au Foyer, une recette inconnue, un
 * planning arrêté ou qui attend encore une décision.
 */
@Injectable()
export class MealPlanService {
  constructor(private readonly repository: MealPlanRepository) {}

  /** Le planning d'une semaine existe dès qu'on le lit : vide, et ouvert. */
  async lire({ week }: MealPlanQuery): Promise<MealPlan> {
    return exposer(await this.repository.lireOuCreer(week));
  }

  async ajouter(
    planId: string,
    saisie: MealPlanEntryInput,
    compteId: string,
  ): Promise<MealPlanEntry> {
    const planning = await this.planningOuvert(planId);
    await this.verifier(planning, saisie, compteId);

    return exposerLeRepas(
      await this.ecrire(
        this.repository.ajouter(planId, {
          day: saisie.day,
          moment: saisie.moment,
          recipeId: saisie.recipeId ?? null,
          title: saisie.title ?? null,
          participantIds: unique(saisie.participantIds),
          guestCount: saisie.guestCount,
        }),
        planId,
      ),
    );
  }

  async modifier(
    planId: string,
    id: string,
    saisie: MealPlanEntryUpdate,
    compteId: string,
  ): Promise<MealPlanEntry> {
    const changements = enChangements(saisie);
    if (Object.keys(changements).length === 0) {
      throw new ErreurMetier(
        'food.entry_empty_update',
        'La modification ne change rien.',
      );
    }

    const planning = await this.planningOuvert(planId);
    repasDe(planning, id);
    await this.verifier(planning, saisie, compteId);

    return exposerLeRepas(
      await this.ecrire(
        this.repository.modifier(planId, id, changements),
        planId,
        id,
      ),
    );
  }

  async supprimer(planId: string, id: string): Promise<void> {
    const planning = await this.planningOuvert(planId);
    repasDe(planning, id);

    await this.ecrire(this.repository.supprimer(planId, id), planId, id);
  }

  /**
   * Un planning s'arrête quand chaque repas est décidé : un repas encore
   * proposé le retient.
   */
  async arreter(id: string): Promise<MealPlan> {
    try {
      return exposer(await this.repository.arreter(id));
    } catch (erreur) {
      if (codePrisma(erreur) !== 'P2025') {
        throw erreur;
      }
      const planning = await this.planning(id);
      if (planning.status === 'STOPPED') {
        throw new ErreurMetier(
          'food.plan_already_stopped',
          'Ce planning est déjà arrêté.',
        );
      }
      throw new ErreurMetier(
        'food.plan_has_pending',
        "Un repas proposé attend encore d'être approuvé ou refusé.",
      );
    }
  }

  /**
   * Rouvrir un planning ne touche jamais une Liste de courses déjà tirée de
   * lui (ADR 0012).
   */
  async rouvrir(id: string): Promise<MealPlan> {
    try {
      return exposer(await this.repository.rouvrir(id));
    } catch (erreur) {
      if (codePrisma(erreur) !== 'P2025') {
        throw erreur;
      }
      await this.planning(id);
      throw new ErreurMetier(
        'food.plan_already_open',
        "Ce planning n'est pas arrêté.",
      );
    }
  }

  private async planning(id: string): Promise<MealPlanRecord> {
    const planning = await this.repository.lire(id);
    if (!planning) {
      throw new Introuvable(
        'food.plan_not_found',
        'Aucun Planning de repas de cet identifiant.',
      );
    }
    return planning;
  }

  private async planningOuvert(id: string): Promise<MealPlanRecord> {
    const planning = await this.planning(id);
    if (planning.status === 'STOPPED') {
      throw planningArrete();
    }
    return planning;
  }

  /** Ce que la saisie nomme : un jour, des Participants, une recette. */
  private async verifier(
    planning: MealPlanRecord,
    {
      day,
      recipeId,
      participantIds,
    }: Pick<MealPlanEntryUpdate, 'day' | 'recipeId' | 'participantIds'>,
    compteId: string,
  ): Promise<void> {
    if (day !== undefined && !estDansLaSemaine(day, planning.week)) {
      throw new ErreurMetier(
        'food.entry_out_of_week',
        "Ce jour n'est pas dans la semaine du planning.",
      );
    }
    if (participantIds !== undefined) {
      await this.verifierLesParticipants(participantIds, compteId);
    }
    if (
      recipeId !== undefined &&
      !(await this.repository.recetteExiste(recipeId))
    ) {
      throw recetteInconnue();
    }
  }

  /** Un repas a au moins un Participant, et chacun est un Compte du Foyer. */
  private async verifierLesParticipants(
    participantIds: readonly string[],
    compteId: string,
  ): Promise<void> {
    const ids = unique(participantIds);
    if (ids.length === 0) {
      throw new ErreurMetier(
        'food.entry_no_participant',
        'Un repas a au moins un Participant.',
      );
    }
    const membres = await this.repository.membresDuFoyer(ids, compteId);
    if (membres.size !== ids.length) {
      throw new ErreurMetier(
        'food.unknown_participant',
        "Un Participant n'est pas un Compte du Foyer.",
      );
    }
  }

  /**
   * Une écriture échoue si le planning a été arrêté, ou le repas supprimé,
   * depuis qu'on l'a lu : on relit pour dire lequel. Sa clé étrangère vers la
   * recette cède si celle-ci a été supprimée depuis sa vérification.
   */
  private async ecrire<T>(
    operation: Promise<T>,
    planId: string,
    id?: string,
  ): Promise<T> {
    try {
      return await operation;
    } catch (erreur) {
      if (codePrisma(erreur) === 'P2003') {
        throw recetteInconnue();
      }
      if (codePrisma(erreur) !== 'P2025') {
        throw erreur;
      }
      const planning = await this.planningOuvert(planId);
      if (id) {
        repasDe(planning, id);
      }
      throw erreur;
    }
  }
}

function codePrisma(erreur: unknown): unknown {
  return typeof erreur === 'object' && erreur !== null && 'code' in erreur
    ? erreur.code
    : undefined;
}

function recetteInconnue(): ErreurMetier {
  return new ErreurMetier(
    'food.entry_unknown_recipe',
    "Ce repas cite une Recette qui n'existe pas.",
  );
}

function planningArrete(): ErreurMetier {
  return new ErreurMetier(
    'food.plan_stopped',
    'Ce planning est arrêté : rouvrez-le pour modifier ses repas.',
  );
}

/** Un repas n'existe que dans son planning. */
function repasDe(planning: MealPlanRecord, id: string): MealPlanEntryRecord {
  const repas = planning.entries.find((entree) => entree.id === id);
  if (!repas) {
    throw new Introuvable(
      'food.entry_not_found',
      'Aucun Repas planifié de cet identifiant dans ce planning.',
    );
  }
  return repas;
}

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

/**
 * Une modification ne porte que ce qu'elle change. Une recette remplace
 * l'intitulé, et un intitulé la recette.
 */
function enChangements({
  recipeId,
  title,
  participantIds,
  ...reste
}: MealPlanEntryUpdate): Partial<MealPlanEntryWrite> {
  return {
    ...Object.fromEntries(
      Object.entries(reste).filter(([, valeur]) => valeur !== undefined),
    ),
    ...(participantIds !== undefined
      ? { participantIds: unique(participantIds) }
      : {}),
    ...(recipeId !== undefined ? { recipeId, title: null } : {}),
    ...(title !== undefined ? { title, recipeId: null } : {}),
  };
}

function exposerLeRepas(repas: MealPlanEntryRecord): MealPlanEntry {
  return {
    id: repas.id,
    day: repas.day,
    moment: repas.moment,
    recipe: repas.recipe,
    title: repas.title,
    participantIds: repas.participantIds,
    guestCount: repas.guestCount,
    servings: portions(repas),
    decision: repas.decision,
    createdAt: repas.createdAt.toISOString(),
  };
}

function exposer(planning: MealPlanRecord): MealPlan {
  return {
    id: planning.id,
    week: planning.week,
    status: planning.status,
    entries: planning.entries.map(exposerLeRepas),
    createdAt: planning.createdAt.toISOString(),
  };
}
