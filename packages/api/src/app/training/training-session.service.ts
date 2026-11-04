import { Injectable } from '@nestjs/common';
import type {
  TrainingSession,
  TrainingSessionCompletion,
  TrainingSessionInput,
  TrainingSessionListQuery,
  TrainingSessionUpdate,
  TrainingSeriesInput,
} from '@personal-os/contracts';
import { Introuvable } from '../erreurs/erreur-metier';
import { espacePersonnelCourant } from '../espace/espace-personnel';
import { completer, manquer, modifier, type Transition } from './seance';
import {
  TrainingSessionRepository,
  type TrainingSessionRecord,
  type TrainingSessionWrite,
} from './training-session.repository';

/**
 * Les saisies arrivent validées par leur schéma (ADR 0030) ; les règles de vie
 * d'une Séance sont dans `seance.ts`. Il ne reste ici que le branchement : lire
 * la Séance à travers la garde, juger, écrire.
 *
 * Le Sport n'accepte que l'Espace personnel : c'est lui qui le pose à la
 * création (ADR 0030). Une Séance de l'autre Compte est hors du filtre de la
 * garde, donc introuvable : on ne confirme pas son existence (ADR 0028).
 */
@Injectable()
export class TrainingSessionService {
  constructor(private readonly repository: TrainingSessionRepository) {}

  async lister(periode: TrainingSessionListQuery): Promise<TrainingSession[]> {
    const seances = await this.repository.listerEntre(
      new Date(periode.from),
      new Date(periode.to),
    );

    return seances.map(exposer);
  }

  /** Les Séances liées à un Objectif, que l'appelant a déjà trouvé. */
  async listerDeLObjectif(goalId: string): Promise<TrainingSession[]> {
    return (await this.repository.listerDeLObjectif(goalId)).map(exposer);
  }

  /**
   * Crée, liée à un Objectif que l'appelant a déjà trouvé, une Séance prévue
   * à chacun de ces débuts, toutes avec le même prévu. Elles restent ensuite
   * indépendantes (ADR 0022).
   */
  async creerEnSerie(
    goalId: string,
    debuts: readonly string[],
    serie: TrainingSeriesInput,
  ): Promise<TrainingSession[]> {
    const scopeId = espacePersonnelCourant();
    const seances = await this.repository.creerPlusieurs(
      debuts.map((debut) => ({
        startsAt: new Date(debut),
        sport: serie.sport,
        status: 'PLANNED',
        plannedDistanceM: serie.plannedDistanceM ?? null,
        plannedDurationS: serie.plannedDurationS ?? null,
        plannedIntent: serie.plannedIntent ?? null,
        actualDistanceM: null,
        actualDurationS: null,
        actualNotes: null,
        goalId,
        scopeId,
      })),
    );

    return seances.map(exposer);
  }

  async lire(id: string): Promise<TrainingSession> {
    return exposer(await this.trouver(id));
  }

  async creer(saisie: TrainingSessionInput): Promise<TrainingSession> {
    return exposer(
      await this.repository.creer({
        startsAt: new Date(saisie.startsAt),
        sport: saisie.sport,
        status: saisie.status,
        plannedDistanceM: saisie.plannedDistanceM ?? null,
        plannedDurationS: saisie.plannedDurationS ?? null,
        plannedIntent: saisie.plannedIntent ?? null,
        actualDistanceM: saisie.actualDistanceM ?? null,
        actualDurationS: saisie.actualDurationS ?? null,
        actualNotes: saisie.actualNotes ?? null,
        scopeId: espacePersonnelCourant(),
      }),
    );
  }

  async modifier(
    id: string,
    saisie: TrainingSessionUpdate,
  ): Promise<TrainingSession> {
    return this.juger(id, (seance) => {
      const { startsAt, ...champs } = modifier(seance, saisie);
      return {
        ...champs,
        ...(startsAt === undefined ? {} : { startsAt: new Date(startsAt) }),
      };
    });
  }

  async completer(
    id: string,
    realise: TrainingSessionCompletion,
  ): Promise<TrainingSession> {
    return this.juger(id, (seance) => completer(seance, realise));
  }

  async manquer(id: string): Promise<TrainingSession> {
    return this.juger(id, manquer);
  }

  private async trouver(id: string): Promise<TrainingSessionRecord> {
    const seance = await this.repository.lire(id);
    if (!seance) {
      throw introuvable();
    }
    return seance;
  }

  /**
   * Lit la Séance, la juge, et n'écrit que sur le statut jugé. Si une autre
   * écriture l'a changé entre-temps, on reprend sur la Séance neuve : la règle
   * refuse alors ce qui n'est plus permis (une Séance réalisée ne se manque
   * plus), au lieu de mêler les deux écritures.
   */
  private async juger(
    id: string,
    regle: (
      seance: TrainingSessionRecord,
    ) => Partial<TrainingSessionWrite> | Transition,
  ): Promise<TrainingSession> {
    const seance = await this.trouver(id);
    const ecrite = await this.repository.modifier(
      id,
      seance.status,
      regle(seance),
    );

    return ecrite ? exposer(ecrite) : this.juger(id, regle);
  }
}

function introuvable(): Introuvable {
  return new Introuvable(
    'training.not_found',
    'Aucune Séance de cet identifiant.',
  );
}

function exposer(seance: TrainingSessionRecord): TrainingSession {
  return {
    ...seance,
    startsAt: seance.startsAt.toISOString(),
    createdAt: seance.createdAt.toISOString(),
  };
}
