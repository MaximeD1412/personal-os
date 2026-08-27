import { Injectable } from '@nestjs/common';
import { ID_FOYER, PrismaService } from '@personal-os/database';
import type { Identite } from './oidc.client';

export interface LoginTransactionRecord {
  id: string;
  state: string;
  nonce: string;
  codeVerifier: string;
  expiresAt: Date;
}

export interface UserRecord {
  id: string;
  email: string;
  displayName: string | null;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async ouvrirTransaction(
    transaction: Omit<LoginTransactionRecord, 'id'>,
  ): Promise<string> {
    const { id } = await this.prisma.loginTransaction.create({
      data: transaction,
      select: { id: true },
    });
    return id;
  }

  async consommerTransaction(
    id: string,
  ): Promise<LoginTransactionRecord | null> {
    try {
      return await this.prisma.loginTransaction.delete({ where: { id } });
    } catch {
      return null;
    }
  }

  async purgerTransactionsExpirees(maintenant: Date): Promise<void> {
    await this.prisma.loginTransaction.deleteMany({
      where: { expiresAt: { lt: maintenant } },
    });
  }

  async apparier(identite: Identite): Promise<UserRecord> {
    const selection = { id: true, email: true, displayName: true } as const;
    const connu = await this.prisma.user.findUnique({
      where: { subject: identite.subject },
      select: { id: true },
    });

    const user = connu
      ? await this.prisma.user.update({
          where: { id: connu.id },
          data: {
            email: identite.email,
            displayName: identite.displayName,
            lastSeenAt: new Date(),
          },
          select: selection,
        })
      : await this.prisma.user.upsert({
          where: { email: identite.email },
          create: {
            subject: identite.subject,
            email: identite.email,
            displayName: identite.displayName,
            householdId: ID_FOYER,
          },
          update: {
            subject: identite.subject,
            displayName: identite.displayName,
            lastSeenAt: new Date(),
          },
          select: selection,
        });

    await this.assurerEspacePersonnel(user);
    return user;
  }

  /**
   * Un Compte porte l'Espace personnel de sa personne. On le pose à chaque
   * appariement plutôt qu'à la seule création : un Compte créé par la version
   * précédente de l'API n'en a pas, et le reçoit ainsi à sa connexion suivante.
   */
  private async assurerEspacePersonnel(user: UserRecord): Promise<void> {
    await this.prisma.scope.upsert({
      where: { holderId: user.id },
      create: {
        kind: 'PERSONAL',
        label: user.displayName ?? user.email,
        householdId: null,
        holderId: user.id,
      },
      update: {},
      select: { id: true },
    });

    // La colonne User.householdId reste le pont avec l'ancienne version de
    // l'API ; la relation d'appartenance devient la source de vérité pour les
    // nouveaux chemins de lecture et permet à terme plusieurs foyers.
    await this.prisma.householdMember.upsert({
      where: {
        householdId_userId: { householdId: ID_FOYER, userId: user.id },
      },
      create: { householdId: ID_FOYER, userId: user.id, role: 'MEMBER' },
      update: {},
      select: { id: true },
    });
  }

  async ouvrirSession(
    tokenHash: string,
    userId: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.session.create({
      data: { tokenHash, userId, expiresAt },
    });
  }

  async lireSession(
    tokenHash: string,
    maintenant: Date,
  ): Promise<UserRecord | null> {
    const session = await this.prisma.session.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: maintenant },
      },
      select: {
        user: { select: { id: true, email: true, displayName: true } },
      },
    });

    return session?.user ?? null;
  }

  async revoquerSession(tokenHash: string, maintenant: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: maintenant },
    });
  }

  async purgerSessionsExpirees(maintenant: Date): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { expiresAt: { lt: maintenant } },
    });
  }
}
