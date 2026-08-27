import { Injectable } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { cloisonner } from './espace/cloisonnement';
import { porteeCourante } from './espace/portee';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Le point d'accès unique aux données, et le seul endroit où le filtrage par
 * Espace s'applique (ADR 0016). Il n'existe pas de client nu ailleurs : le
 * paquet n'en exporte aucun, et il n'y a donc rien à contourner.
 */
@Injectable()
export class PrismaService {
  #client: PrismaClient;

  constructor() {
    const connectionString = process.env['DATABASE_URL'];
    if (!connectionString) {
      throw new Error("DATABASE_URL est requis pour ouvrir l'accès aux données.");
    }
    const client = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });

    // `$extends` rend un nouveau client plutôt que de modifier celui-ci : c'est
    // lui que l'on conserve derrière la façade. L'extension ne change aucun
    // type de modèle, seulement les arguments qui les atteignent.
    this.#client = client.$extends({
      query: {
        $allModels: {
          $allOperations({ model, operation, args, query }) {
            return query(
              cloisonner(
                { model, operation, args: args as Record<string, unknown> },
                porteeCourante(),
              ),
            );
          },
        },
      },
    }) as unknown as PrismaClient;
  }

  /** Les seuls délégués exposés aux dépôts applicatifs. */
  get healthProbe() {
    return this.#client.healthProbe;
  }

  get household() {
    return this.#client.household;
  }

  get householdMember() {
    return this.#client.householdMember;
  }

  get scope() {
    return this.#client.scope;
  }

  get user() {
    return this.#client.user;
  }

  get trace() {
    return this.#client.trace;
  }

  get session() {
    return this.#client.session;
  }

  get loginTransaction() {
    return this.#client.loginTransaction;
  }

  async $connect(): Promise<void> {
    await this.#client.$connect();
  }

  async $disconnect(): Promise<void> {
    await this.#client.$disconnect();
  }
}
