import { Injectable } from '@nestjs/common';
import type { EventCategory } from '@personal-os/contracts';
import { PrismaService } from '@personal-os/database';

export interface EventRecord {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  category: EventCategory;
  reminderLeadMinutes: number | null;
  scopeId: string;
  createdAt: Date;
}

/** Ce qu'une écriture pose, une fois la saisie validée par le service. */
export interface EventWrite {
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  category: EventCategory;
  reminderLeadMinutes: number | null;
  scopeId: string;
}

/**
 * Aucun filtre par Espace n'apparaît ici, et c'est la preuve que le mécanisme
 * central fonctionne : la garde ajoute le sien à toutes ces requêtes.
 * En trouver un à la main signalerait qu'elle a été contournée (ADR 0016).
 */
@Injectable()
export class EventRepository {
  constructor(private readonly prisma: PrismaService) {}

  lister(): Promise<EventRecord[]> {
    return this.prisma.event.findMany({ orderBy: { startsAt: 'asc' } });
  }

  /**
   * Les Événements qui **rencontrent** la période, et non ceux qui y
   * commencent : des vacances entamées en juillet appartiennent bien à
   * l'agenda du mois d'août. Un Événement sans fin distincte finit là où il
   * commence.
   */
  listerEntre(debut: Date, fin: Date): Promise<EventRecord[]> {
    return this.prisma.event.findMany({
      where: {
        startsAt: { lte: fin },
        OR: [
          { endsAt: { gte: debut } },
          { endsAt: null, startsAt: { gte: debut } },
        ],
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  lire(id: string): Promise<EventRecord | null> {
    return this.prisma.event.findUnique({ where: { id } });
  }

  creer(saisie: EventWrite): Promise<EventRecord> {
    return this.prisma.event.create({ data: saisie });
  }

  modifier(id: string, saisie: Partial<EventWrite>): Promise<EventRecord> {
    return this.prisma.event.update({ where: { id }, data: saisie });
  }

  supprimer(id: string): Promise<EventRecord> {
    return this.prisma.event.delete({ where: { id } });
  }
}
