import { Injectable } from '@nestjs/common';
import type { CanonicalUnit } from '@personal-os/contracts';
import { ID_ESPACE_FOYER, PrismaService } from '@personal-os/database';

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

  async ingredientExiste(id: string): Promise<boolean> {
    return (await this.prisma.ingredient.count({ where: { id } })) > 0;
  }
}

/** Un jour civil part en base comme le minuit UTC de ce jour, que `DATE` garde tel quel. */
function versLaBase(jour: string | null): Date | null {
  return jour === null ? null : new Date(`${jour}T00:00:00Z`);
}
