import { Injectable } from '@nestjs/common';
import { PrismaService } from '@personal-os/database';

export interface TraceRecord {
  id: string;
  label: string;
  scopeId: string;
  createdAt: Date;
}

/**
 * Aucun filtre par Espace n'apparaît ici, et c'est la preuve que le mécanisme
 * central fonctionne : la garde ajoute le sien à toutes ces requêtes.
 * En trouver un à la main signalerait qu'elle a été contournée (ADR 0016).
 */
@Injectable()
export class TraceRepository {
  constructor(private readonly prisma: PrismaService) {}

  lister(): Promise<TraceRecord[]> {
    return this.prisma.trace.findMany({ orderBy: { createdAt: 'desc' } });
  }

  lire(id: string): Promise<TraceRecord | null> {
    return this.prisma.trace.findUnique({ where: { id } });
  }

  creer(label: string, scopeId: string): Promise<TraceRecord> {
    return this.prisma.trace.create({ data: { label, scopeId } });
  }

  renommer(id: string, label: string): Promise<TraceRecord> {
    return this.prisma.trace.update({ where: { id }, data: { label } });
  }

  supprimer(id: string): Promise<TraceRecord> {
    return this.prisma.trace.delete({ where: { id } });
  }
}
