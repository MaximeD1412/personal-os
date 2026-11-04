import { Injectable } from '@nestjs/common';
import type { AgendaItem, AgendaPeriod } from '@personal-os/contracts';
import { AgendaRegistry } from '../agenda-port/agenda.registry';

/**
 * L'Agenda : la vue en lecture seule qui fusionne, pour une période donnée,
 * les objets datés des modules.
 *
 * Il n'importe aucun domaine et n'en connaît aucun. Ce qu'il sait des modules,
 * il le tient du registre, et rien d'autre (ADR 0011). La période lui arrive
 * déjà validée par son schéma : il n'en juge pas la forme (ADR 0030).
 */
@Injectable()
export class AgendaService {
  constructor(private readonly registre: AgendaRegistry) {}

  async lister(periode: AgendaPeriod): Promise<AgendaItem[]> {
    const parContributeur = await Promise.all(
      this.registre.tous().map((contributeur) => contributeur.lister(periode)),
    );

    return parContributeur.flat().sort(parDateDeDebut);
  }
}

function parDateDeDebut(gauche: AgendaItem, droite: AgendaItem): number {
  return gauche.startsAt.localeCompare(droite.startsAt);
}
