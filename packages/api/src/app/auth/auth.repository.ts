import { Injectable } from '@nestjs/common';
import { PrismaService } from '@personal-os/database';
import type { Identite } from './oidc.client';

/** Un aller-retour OIDC tel qu'il est retenu entre le départ et le retour. */
export interface LoginTransactionRecord {
  id: string;
  state: string;
  nonce: string;
  codeVerifier: string;
  expiresAt: Date;
}

/** Un compte du foyer. */
export interface UserRecord {
  id: string;
  email: string;
  displayName: string | null;
}

/** Accès aux données de l'authentification (ADR 0016 : module plat). */
@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  // --- Allers-retours OIDC ------------------------------------------------

  async ouvrirTransaction(
    transaction: Omit<LoginTransactionRecord, 'id'>,
  ): Promise<string> {
    const { id } = await this.prisma.loginTransaction.create({
      data: transaction,
      select: { id: true },
    });
    return id;
  }

  /**
   * Consomme un aller-retour : il est lu **et** supprimé.
   *
   * La suppression est ce qui interdit de rejouer un code d'autorisation : le
   * second passage ne trouve plus rien, quel que soit l'état présenté.
   */
  async consommerTransaction(
    id: string,
  ): Promise<LoginTransactionRecord | null> {
    try {
      // `delete` rend la rangée supprimée : la lecture et la suppression sont
      // le même aller-retour, donc deux retours concurrents ne peuvent pas
      // consommer la même transaction.
      return await this.prisma.loginTransaction.delete({ where: { id } });
    } catch {
      return null;
    }
  }

  /** Fait le ménage des allers-retours jamais terminés. */
  async purgerTransactionsExpirees(maintenant: Date): Promise<void> {
    await this.prisma.loginTransaction.deleteMany({
      where: { expiresAt: { lt: maintenant } },
    });
  }

  // --- Comptes ------------------------------------------------------------

  /**
   * Apparie une identité Authentik à un compte local.
   *
   * L'appariement se fait par le sujet quand il est déjà connu, par l'adresse
   * sinon. Les deux cas existent pour de vrai : un compte Authentik recréé
   * porte un nouveau sujet sous la même adresse, et une adresse corrigée dans
   * Authentik arrive sous un sujet déjà connu.
   *
   * L'admission, elle, n'est pas décidée ici : cette méthode n'est appelée que
   * pour une adresse déjà admise.
   */
  async apparier(identite: Identite): Promise<UserRecord> {
    const selection = { id: true, email: true, displayName: true } as const;
    const connu = await this.prisma.user.findUnique({
      where: { subject: identite.subject },
      select: { id: true },
    });

    if (connu) {
      return this.prisma.user.update({
        where: { id: connu.id },
        data: {
          email: identite.email,
          displayName: identite.displayName,
          lastSeenAt: new Date(),
        },
        select: selection,
      });
    }

    return this.prisma.user.upsert({
      where: { email: identite.email },
      create: {
        subject: identite.subject,
        email: identite.email,
        displayName: identite.displayName,
      },
      update: {
        subject: identite.subject,
        displayName: identite.displayName,
        lastSeenAt: new Date(),
      },
      select: selection,
    });
  }

  // --- Sessions -----------------------------------------------------------

  async ouvrirSession(
    tokenHash: string,
    userId: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.session.create({
      data: { tokenHash, userId, expiresAt },
    });
  }

  /** Le porteur d'une session encore vivante, ou rien. */
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

  /**
   * Révoque une session, du côté serveur.
   *
   * Elle est marquée plutôt que supprimée : une session révoquée reste une
   * trace, et la marque distingue « déconnectée » de « jamais existé » le jour
   * où il faudra comprendre un accès.
   */
  async revoquerSession(tokenHash: string, maintenant: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: maintenant },
    });
  }

  /** Fait le ménage des sessions dont plus personne ne peut se servir. */
  async purgerSessionsExpirees(maintenant: Date): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { expiresAt: { lt: maintenant } },
    });
  }
}
