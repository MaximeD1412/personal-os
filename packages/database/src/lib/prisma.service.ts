import { Injectable } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { cloisonner } from './espace/cloisonnement';
import { lireLeModeleDeDonnees, lireLeSchema } from './espace/modeles';
import { porteeCourante } from './espace/portee';
import { PrismaClient, type Prisma } from '../generated/prisma/client';

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
      throw new Error(
        "DATABASE_URL est requis pour ouvrir l'accès aux données.",
      );
    }
    const client = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
    const schema = lireLeSchema(lireLeModeleDeDonnees(client));

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
                schema,
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

  get scope() {
    return this.#client.scope;
  }

  get user() {
    return this.#client.user;
  }

  get event() {
    return this.#client.event;
  }

  get eventException() {
    return this.#client.eventException;
  }

  get aiTrace() {
    return this.#client.aiTrace;
  }

  get unresolvedCommand() {
    return this.#client.unresolvedCommand;
  }

  get ingredient() {
    return this.#client.ingredient;
  }

  get ingredientAlias() {
    return this.#client.ingredientAlias;
  }

  get recipe() {
    return this.#client.recipe;
  }

  get recipeLine() {
    return this.#client.recipeLine;
  }

  get session() {
    return this.#client.session;
  }

  get loginTransaction() {
    return this.#client.loginTransaction;
  }

  /**
   * Des opérations de délégué exécutées ensemble, ou pas du tout. Seule la
   * forme en lot est exposée : chaque opération passe par la garde comme
   * les autres. La forme interactive donnerait un client de transaction, et
   * avec lui le SQL brut que la façade refuse.
   */
  $transaction<P extends Prisma.PrismaPromise<unknown>[]>(operations: [...P]) {
    // Le type l'interdit déjà ; un appel non typé ne doit pas l'obtenir non plus.
    if (!Array.isArray(operations)) {
      throw new Error("Une transaction ne s'ouvre qu'en lot d'opérations.");
    }
    return this.#client.$transaction(operations);
  }

  async $connect(): Promise<void> {
    await this.#client.$connect();
  }

  async $disconnect(): Promise<void> {
    await this.#client.$disconnect();
  }
}
