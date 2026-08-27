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

  /** Les trois Espaces atteints par un Compte : son personnel et le Foyer. */
  espacesDe(userId: string): Promise<EspaceRecord[]> {
    return this.prisma.scope.findMany({
      where: {
        OR: [
          { holderId: userId },
          {
            kind: 'HOUSEHOLD',
            household: { members: { some: { id: userId } } },
          },
        ],
      },
      select: { id: true, kind: true, label: true },
      orderBy: [{ kind: 'asc' }, { label: 'asc' }],
    });
  }
}
