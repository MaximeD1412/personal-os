import { BadRequestException, Injectable } from '@nestjs/common';
import type { AgendaItem, AgendaPeriod } from '@personal-os/contracts';
import { AgendaRegistry } from '../agenda-port/agenda.registry';

/**
 * L'Agenda : la vue en lecture seule qui fusionne, pour une période donnée,
 * les objets datés des modules.
 *
 * Il n'importe aucun domaine et n'en connaît aucun. Ce qu'il sait des modules,
 * il le tient du registre, et rien d'autre (ADR 0011).
 */
@Injectable()
export class AgendaService {
  constructor(private readonly registre: AgendaRegistry) {}

  async lister(demande: Partial<AgendaPeriod>): Promise<AgendaItem[]> {
    const periode = validerLaPeriode(demande);

    const parContributeur = await Promise.all(
      this.registre.tous().map((contributeur) => contributeur.lister(periode)),
    );

    return parContributeur.flat().sort(parDateDeDebut);
  }
}

/**
 * Les deux bornes sont obligatoires : l'Agenda est une vue « pour une période
 * donnée » (ADR 0011), et l'ouvrir sans bornes ferait interroger tous les
 * modules sur toute leur histoire.
 */
function validerLaPeriode(demande: Partial<AgendaPeriod>): AgendaPeriod {
  const from = instantRequis(demande.from, 'from');
  const to = instantRequis(demande.to, 'to');

  if (to.getTime() < from.getTime()) {
    throw new BadRequestException(
      "La fin d'une période ne précède pas son début.",
    );
  }

  return { from: from.toISOString(), to: to.toISOString() };
}

function instantRequis(valeur: unknown, champ: string): Date {
  if (typeof valeur !== 'string' || valeur.trim().length === 0) {
    throw new BadRequestException(`${champ} est requis.`);
  }

  const instant = new Date(valeur);
  if (Number.isNaN(instant.getTime())) {
    throw new BadRequestException(`${champ} attend une date ISO-8601.`);
  }
  return instant;
}

function parDateDeDebut(gauche: AgendaItem, droite: AgendaItem): number {
  return gauche.startsAt.localeCompare(droite.startsAt);
}
