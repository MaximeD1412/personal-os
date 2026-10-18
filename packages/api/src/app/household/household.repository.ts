import { Injectable } from '@nestjs/common';
import { PrismaService } from '@personal-os/database';

export interface MemberRecord {
  id: string;
  email: string;
  displayName: string | null;
}

export interface HouseholdRecord {
  id: string;
  name: string;
  members: MemberRecord[];
}

/**
 * `Household` et `User` sont hors Espace : la garde ne filtre rien ici, et il
 * n'y a rien à déclarer pour les lire (ADR 0016).
 */
@Injectable()
export class HouseholdRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Le Foyer d'un Compte, et ses membres dans l'ordre de leur arrivée. */
  foyerDe(userId: string): Promise<HouseholdRecord | null> {
    return this.prisma.household.findFirst({
      where: { members: { some: { id: userId } } },
      select: {
        id: true,
        name: true,
        members: {
          select: { id: true, email: true, displayName: true },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
    });
  }
}
