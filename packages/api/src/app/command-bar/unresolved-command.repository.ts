import { Injectable } from '@nestjs/common';
import { PrismaService } from '@personal-os/database';

export interface UnresolvedCommandRecord {
  id: string;
  scopeId: string;
  text: string;
  createdAt: Date;
}

/**
 * Le journal des commandes non comprises. Aucun filtre par Espace n'apparaît
 * ici : la garde ajoute le sien (ADR 0016).
 */
@Injectable()
export class UnresolvedCommandRepository {
  constructor(private readonly prisma: PrismaService) {}

  creer(ecriture: {
    scopeId: string;
    text: string;
  }): Promise<UnresolvedCommandRecord> {
    return this.prisma.unresolvedCommand.create({ data: ecriture });
  }

  /**
   * Une page du journal, des plus récentes aux plus anciennes, à partir de la
   * commande qui suit le curseur. L'identifiant départage deux commandes
   * posées dans la même milliseconde.
   */
  page(
    cursor: string | undefined,
    taille: number,
  ): Promise<UnresolvedCommandRecord[]> {
    return this.prisma.unresolvedCommand.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: taille,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  }
}
