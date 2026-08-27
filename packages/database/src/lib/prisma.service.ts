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
export class PrismaService extends PrismaClient {
  constructor() {
    const connectionString = process.env['DATABASE_URL'];
    if (!connectionString) {
      throw new Error("DATABASE_URL est requis pour ouvrir l'accès aux données.");
    }
    super({ adapter: new PrismaPg({ connectionString }) });

    // `$extends` rend un nouveau client plutôt que de modifier celui-ci : c'est
    // lui qu'on livre, en le renvoyant du constructeur. L'extension ne change
    // aucun type de modèle, seulement les arguments qui les atteignent.
    return this.$extends({
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
    }) as unknown as PrismaService;
  }
}
