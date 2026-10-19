import { Injectable } from '@nestjs/common';
import type {
  AiTrace,
  AiTraceListQuery,
  AiTracePage,
  AiTraceSummary,
} from '@personal-os/contracts';
import { Introuvable } from '../erreurs/erreur-metier';
import { AiTraceRepository, type AiTraceRecord } from './ai-trace.repository';

/**
 * La lecture du journal des traces IA. Il est en ajout seul : on ne modifie
 * ni ne supprime une trace, on la consulte pour comprendre une proposition.
 */
@Injectable()
export class AiTraceService {
  constructor(private readonly repository: AiTraceRepository) {}

  /** Une page, et le curseur de la suivante s'il en reste une. */
  async page({ cursor, limit }: AiTraceListQuery): Promise<AiTracePage> {
    // Une trace de plus que demandé : sa présence dit qu'une page suit.
    const traces = await this.repository.page(cursor, limit + 1);
    const items = traces.slice(0, limit);

    return {
      items: items.map(resumer),
      nextCursor: traces.length > limit ? items[items.length - 1].id : null,
    };
  }

  async lire(id: string): Promise<AiTrace> {
    const trace = await this.repository.lire(id);
    if (!trace) {
      throw new Introuvable(
        'ai.trace_not_found',
        'Aucune trace IA de cet identifiant.',
      );
    }

    return {
      ...resumer(trace),
      system: trace.system,
      input: trace.input,
      output: trace.output,
    };
  }
}

function resumer(trace: AiTraceRecord): AiTraceSummary {
  return {
    id: trace.id,
    scopeId: trace.scopeId,
    purpose: trace.purpose,
    model: trace.model,
    inputTokens: trace.inputTokens,
    outputTokens: trace.outputTokens,
    costCents: trace.costCents,
    createdAt: trace.createdAt.toISOString(),
  };
}
