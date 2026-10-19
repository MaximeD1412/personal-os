import { Injectable } from '@nestjs/common';
import type {
  TrainingSession,
  TrainingSessionCompletion,
  TrainingSessionInput,
  TrainingSessionListQuery,
  TrainingSessionUpdate,
} from '@personal-os/contracts';
import { Introuvable } from '../erreurs/erreur-metier';
import { espacePersonnel } from '../espace/espace-personnel';
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
        scopeId: espacePersonnel(),
      }),
    );
  }

  async modifier(
    id: string,
    saisie: TrainingSessionUpdate,
  ): Promise<TrainingSession> {
    const seance = await this.trouver(id);
    const { startsAt, ...champs } = modifier(seance, saisie);

    return this.ecrire(id, {
      ...champs,
      ...(startsAt === undefined ? {} : { startsAt: new Date(startsAt) }),
    });
  }

  async completer(
    id: string,
    realise: TrainingSessionCompletion,
  ): Promise<TrainingSession> {
    return this.ecrire(id, completer(await this.trouver(id), realise));
  }

  async manquer(id: string): Promise<TrainingSession> {
    return this.ecrire(id, manquer(await this.trouver(id)));
  }

  private async trouver(id: string): Promise<TrainingSessionRecord> {
    const seance = await this.repository.lire(id);
    if (!seance) {
      throw introuvable();
    }
    return seance;
  }

  private async ecrire(
    id: string,
    changements: Partial<TrainingSessionWrite> | Transition,
  ): Promise<TrainingSession> {
    return exposer(await this.repository.modifier(id, changements));
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
