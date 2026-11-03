import { Injectable } from '@nestjs/common';
import { PrismaService, sousPortee } from '@personal-os/database';

export interface AiTraceRecord {
  id: string;
  scopeId: string;
  purpose: string;
  model: string;
  system: string;
  input: string;
  /** Vide quand le fournisseur n'a pas répondu. */
  output: string | null;
  /** Inconnus quand le fournisseur n'a pas répondu. */
  inputTokens: number | null;
  outputTokens: number | null;
  costCents: number;
  /** Pourquoi l'appel n'a rien rendu d'utilisable ; vide pour une réponse retenue. */
  error: string | null;
  createdAt: Date;
}

export type AiTraceWrite = Omit<AiTraceRecord, 'id' | 'createdAt'>;

/**
 * Aucun filtre par Espace n'apparaît ici, et c'est la preuve que le mécanisme
 * central fonctionne : la garde ajoute le sien à toutes ces requêtes
 * (ADR 0016). La somme du plafond est la seule à s'ouvrir à tous les Espaces,
 * pour un nombre et rien d'autre.
 */
@Injectable()
export class AiTraceRepository {
  constructor(private readonly prisma: PrismaService) {}

  creer(ecriture: AiTraceWrite): Promise<AiTraceRecord> {
    return this.prisma.aiTrace.create({ data: ecriture });
  }

  /**
   * Une page du journal, des plus récentes aux plus anciennes, à partir de la
   * trace qui suit le curseur. L'identifiant départage deux traces posées dans
   * la même milliseconde.
   */
  page(cursor: string | undefined, taille: number): Promise<AiTraceRecord[]> {
    return this.prisma.aiTrace.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: taille,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  }

  lire(id: string): Promise<AiTraceRecord | null> {
    return this.prisma.aiTrace.findUnique({ where: { id } });
  }

  /**
   * La somme des coûts des traces posées depuis cet instant, en centimes,
   * dans **tous** les Espaces : le plafond est celui du Foyer, et une trace
   * rangée dans l'Espace personnel de l'autre Compte (une commande de sa
   * barre) a coûté autant qu'une autre. La portée s'élargit le temps de cette
   * somme, qui ne rend qu'un nombre, jamais le contenu d'une trace.
   */
  async coutDepuis(debut: Date): Promise<number> {
    const espaces = await this.prisma.scope.findMany({
      select: { id: true, kind: true },
    });

    const somme = await sousPortee(
      { espaces, typesAcceptes: ['PERSONAL', 'HOUSEHOLD'] },
      // Attendue ici : une requête Prisma ne part qu'à son premier `then`, et
      // partirait sinon hors de cette portée.
      async () =>
        await this.prisma.aiTrace.aggregate({
          _sum: { costCents: true },
          where: { createdAt: { gte: debut } },
        }),
    );
    return somme._sum.costCents ?? 0;
  }
}
