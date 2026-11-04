import { Injectable } from '@nestjs/common';
import type {
  TrainingGoal,
  TrainingGoalInput,
  TrainingGoalUpdate,
  TrainingSeriesInput,
  TrainingSession,
} from '@personal-os/contracts';
import { ErreurMetier, Introuvable } from '../erreurs/erreur-metier';
import { espacePersonnelCourant } from '../espace/espace-personnel';
import { planifierLaSerie } from './serie';
import {
  TrainingGoalRepository,
  type TrainingGoalRecord,
} from './training-goal.repository';
import { TrainingSessionService } from './training-session.service';

/**
 * Les Objectifs : une course, une date, une intention, et les Séances qui y
 * mènent (ADR 0022). Les saisies arrivent validées par leur schéma
 * (ADR 0030) ; le calcul d'une série est dans `serie.ts`.
 *
 * Le Sport n'accepte que l'Espace personnel, qu'il pose à la création. Un
 * Objectif de l'autre Compte est hors du filtre de la garde, donc
 * introuvable : on ne confirme pas son existence (ADR 0028).
 */
@Injectable()
export class TrainingGoalService {
  constructor(
    private readonly repository: TrainingGoalRepository,
    private readonly seances: TrainingSessionService,
  ) {}

  async lister(): Promise<TrainingGoal[]> {
    return (await this.repository.lister()).map(exposer);
  }

  async lire(id: string): Promise<TrainingGoal> {
    return exposer(await this.trouver(id));
  }

  async creer(saisie: TrainingGoalInput): Promise<TrainingGoal> {
    return exposer(
      await this.repository.creer({
        title: saisie.title,
        date: saisie.date,
        intent: saisie.intent ?? null,
        scopeId: espacePersonnelCourant(),
      }),
    );
  }

  async modifier(
    id: string,
    saisie: TrainingGoalUpdate,
  ): Promise<TrainingGoal> {
    const changements = Object.fromEntries(
      Object.entries(saisie).filter(([, valeur]) => valeur !== undefined),
    ) as TrainingGoalUpdate;
    if (Object.keys(changements).length === 0) {
      throw new ErreurMetier(
        'training.empty_update',
        'La modification ne change rien.',
      );
    }

    const ecrit = await this.repository.modifier(id, changements);
    if (!ecrit) {
      throw introuvable();
    }
    return exposer(ecrit);
  }

  /** Les Séances liées perdent leur lien ; aucune n'est supprimée. */
  async supprimer(id: string): Promise<void> {
    if (!(await this.repository.supprimer(id))) {
      throw introuvable();
    }
  }

  async seancesDe(id: string): Promise<TrainingSession[]> {
    await this.trouver(id);
    return this.seances.listerDeLObjectif(id);
  }

  /** Les Séances prévues d'une série, chacune liée à l'Objectif. */
  async creerLaSerie(
    id: string,
    serie: TrainingSeriesInput,
  ): Promise<TrainingSession[]> {
    await this.trouver(id);
    return this.seances.creerEnSerie(id, planifierLaSerie(serie), serie);
  }

  private async trouver(id: string): Promise<TrainingGoalRecord> {
    const objectif = await this.repository.lire(id);
    if (!objectif) {
      throw introuvable();
    }
    return objectif;
  }
}

function introuvable(): Introuvable {
  return new Introuvable(
    'training.goal_not_found',
    'Aucun Objectif de cet identifiant.',
  );
}

function exposer(objectif: TrainingGoalRecord): TrainingGoal {
  return { ...objectif, createdAt: objectif.createdAt.toISOString() };
}
