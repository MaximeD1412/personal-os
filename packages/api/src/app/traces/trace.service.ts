import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Trace, TraceInput } from '@personal-os/contracts';
import { ErreurDEspace } from '@personal-os/database';
import { TraceRepository, type TraceRecord } from './trace.repository';

@Injectable()
export class TraceService {
  constructor(private readonly repository: TraceRepository) {}

  async lister(): Promise<Trace[]> {
    return (await this.repository.lister()).map(exposer);
  }

  async creer(saisie: Partial<TraceInput>): Promise<Trace> {
    const label = texteRequis(saisie.label, 'label');
    const scopeId = texteRequis(saisie.scopeId, 'scopeId');

    return exposer(await this.repository.creer(label, scopeId));
  }

  async renommer(id: string, saisie: Partial<TraceInput>): Promise<Trace> {
    const label = texteRequis(saisie.label, 'label');

    return exposer(await this.introuvableSinon(this.repository.renommer(id, label)));
  }

  async supprimer(id: string): Promise<void> {
    await this.introuvableSinon(this.repository.supprimer(id));
  }

  /**
   * Une Trace d'un autre Espace est hors du filtre de la garde : Prisma ne la
   * trouve pas. On répond « introuvable » plutôt qu'« interdit », pour ne pas
   * confirmer son existence à qui aurait deviné son identifiant.
   */
  private async introuvableSinon(
    operation: Promise<TraceRecord>,
  ): Promise<TraceRecord> {
    try {
      return await operation;
    } catch (erreur) {
      // Un refus de la garde est un défaut ou une intrusion : il doit remonter
      // tel quel. Seule l'absence de rangée devient un « introuvable ».
      if (erreur instanceof ErreurDEspace) {
        throw erreur;
      }
      throw new NotFoundException('Aucune Trace de cet identifiant.');
    }
  }
}

function exposer(trace: TraceRecord): Trace {
  return {
    id: trace.id,
    label: trace.label,
    scopeId: trace.scopeId,
    createdAt: trace.createdAt.toISOString(),
  };
}

function texteRequis(valeur: unknown, champ: string): string {
  if (typeof valeur !== 'string' || valeur.trim().length === 0) {
    throw new BadRequestException(`${champ} est requis.`);
  }
  return valeur.trim();
}
