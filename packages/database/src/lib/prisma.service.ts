import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Point d'accès unique à la base.
 *
 * C'est ici que viendra se brancher le filtrage par Espace (ADR 0016) : la
 * garantie de cloisonnement est portée par ce mécanisme central, jamais par la
 * vigilance de chaque module.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private static readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env['DATABASE_URL'];
    if (!connectionString) {
      throw new Error("DATABASE_URL est requis pour ouvrir l'accès aux données.");
    }
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    PrismaService.logger.log('Connexion à la base établie.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
