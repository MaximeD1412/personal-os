import { Injectable } from '@nestjs/common';
import { PrismaService, type TypeEspace } from '@personal-os/database';

export interface EspaceRecord {
  id: string;
  kind: TypeEspace;
  label: string;
}

@Injectable()
export class EspaceRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Les Espaces qu'un Compte atteint : le sien, et celui de son Foyer. Le
   * modèle `Scope` ne porte pas lui-même d'Espace — c'est lui qui les définit —
   * et cette requête traverse donc la garde sans être filtrée.
   */
  espacesDe(userId: string): Promise<EspaceRecord[]> {
    return this.prisma.scope.findMany({
      where: {
        OR: [
          { holderId: userId },
          { kind: 'HOUSEHOLD', household: { members: { some: { id: userId } } } },
        ],
      },
      select: { id: true, kind: true, label: true },
      orderBy: [{ kind: 'asc' }, { label: 'asc' }],
    });
  }
}
