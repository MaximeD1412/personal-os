import { Injectable } from '@nestjs/common';
import type { CanonicalUnit } from '@personal-os/contracts';
import {
  ID_ESPACE_FOYER,
  PrismaService,
  sousPortee,
} from '@personal-os/database';

export interface PantryItemRecord {
  id: string;
  quantity: { toNumber(): number };
  expiresOn: Date | null;
  updatedAt: Date;
  ingredient: { id: string; displayName: string; canonicalUnit: CanonicalUnit };
}

/** Ce qu'une correction pose : la quantité en texte, sans flottant. */
export interface PantryItemWrite {
  quantity: string;
  expiresOn: string | null;
}

/** Le stock n'est que dans l'Espace foyer : la Cuisine le pose elle-même. */
const SOUS_L_ESPACE_FOYER = {
  espaces: [{ id: ID_ESPACE_FOYER, kind: 'HOUSEHOLD' as const }],
  typesAcceptes: ['HOUSEHOLD' as const],
};

const AVEC_L_INGREDIENT = {
  ingredient: { select: { id: true, displayName: true, canonicalUnit: true } },
} as const;

/**
 * `PantryItem` est cloisonné : la garde borne chaque lecture et chaque
 * écriture à l'Espace foyer, que le contrôleur déclare. Il n'y a qu'une ligne
 * par Ingrédient : elle se désigne par lui, dans l'Espace foyer que le module
 * pose lui-même.
 */
@Injectable()
export class PantryItemRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Tout le stock, par ordre alphabétique : une ligne ne bouge pas pendant qu'on l'édite. */
  lister(): Promise<PantryItemRecord[]> {
    return this.prisma.pantryItem.findMany({
      include: AVEC_L_INGREDIENT,
      orderBy: [{ ingredient: { name: 'asc' } }, { id: 'asc' }],
    });
  }

  /** Remplace la ligne de l'Ingrédient, ou la crée. */
  poser(
    ingredientId: string,
    { quantity, expiresOn }: PantryItemWrite,
  ): Promise<PantryItemRecord> {
    const ligne = { quantity, expiresOn: versLaBase(expiresOn) };
    return this.prisma.pantryItem.upsert({
      where: {
        scopeId_ingredientId: { scopeId: ID_ESPACE_FOYER, ingredientId },
      },
      create: { scopeId: ID_ESPACE_FOYER, ingredientId, ...ligne },
      update: ligne,
      include: AVEC_L_INGREDIENT,
    });
  }

  /** Le nombre de lignes supprimées : aucune si l'Ingrédient n'est pas en stock. */
  async supprimer(ingredientId: string): Promise<number> {
    return (
      await this.prisma.pantryItem.deleteMany({ where: { ingredientId } })
    ).count;
  }

  /**
   * L'Ingrédient a-t-il une quantité en stock ? Le catalogue le demande
   * hors Espace, avant de changer une Unité canonique : la portée se pose ici
   * sur l'Espace foyer, et la réponse n'est qu'un oui ou un non.
   */
  async aDuStock(ingredientId: string): Promise<boolean> {
    const lignes = await sousPortee(
      SOUS_L_ESPACE_FOYER,
      // Attendue ici : une requête Prisma ne part qu'à son premier `then`, et
      // partirait sinon hors de cette portée.
      async () =>
        await this.prisma.pantryItem.count({
          where: { ingredientId, quantity: { gt: 0 } },
        }),
    );
    return lignes > 0;
  }

  async ingredientExiste(id: string): Promise<boolean> {
    return (await this.prisma.ingredient.count({ where: { id } })) > 0;
  }
}

/** Un jour civil part en base comme le minuit UTC de ce jour, que `DATE` garde tel quel. */
function versLaBase(jour: string | null): Date | null {
  return jour === null ? null : new Date(`${jour}T00:00:00Z`);
}
