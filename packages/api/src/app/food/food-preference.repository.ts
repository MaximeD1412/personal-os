import { Injectable } from '@nestjs/common';
import type { Allergen, FoodPreferenceKind } from '@personal-os/contracts';
import { PrismaService } from '@personal-os/database';

export interface FoodPreferenceRecord {
  id: string;
  userId: string;
  kind: FoodPreferenceKind;
  allergen: Allergen | null;
  ingredientId: string | null;
  ingredient: { displayName: string } | null;
  createdAt: Date;
}

/** Ce qu'une création pose : une seule des deux cibles est remplie. */
export interface FoodPreferenceWrite {
  scopeId: string;
  userId: string;
  kind: FoodPreferenceKind;
  allergen: Allergen | null;
  ingredientId: string | null;
}

const AVEC_L_INGREDIENT = {
  ingredient: { select: { displayName: true } },
} as const;

/**
 * `FoodPreference` est cloisonnée : la garde borne chaque lecture et chaque
 * suppression à l'Espace foyer, que le contrôleur déclare. `User` et
 * `Ingredient` sont hors Espace, lus sans filtre.
 */
@Injectable()
export class FoodPreferenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Les Préférences du Foyer, ou d'un Compte, dans l'ordre de leur saisie. */
  lister(userId?: string): Promise<FoodPreferenceRecord[]> {
    return this.prisma.foodPreference.findMany({
      where: userId === undefined ? {} : { userId },
      include: AVEC_L_INGREDIENT,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  creer(saisie: FoodPreferenceWrite): Promise<FoodPreferenceRecord> {
    return this.prisma.foodPreference.create({
      data: saisie,
      include: AVEC_L_INGREDIENT,
    });
  }

  /** Le nombre de Préférences supprimées : aucune si l'identifiant est inconnu. */
  async supprimer(id: string): Promise<number> {
    return (await this.prisma.foodPreference.deleteMany({ where: { id } }))
      .count;
  }

  /** Vrai si `userId` est un Compte du Foyer de `compteId`. */
  async duMemeFoyer(userId: string, compteId: string): Promise<boolean> {
    return (
      (await this.prisma.user.count({
        where: {
          id: userId,
          household: { members: { some: { id: compteId } } },
        },
      })) > 0
    );
  }

  async ingredientExiste(id: string): Promise<boolean> {
    return (await this.prisma.ingredient.count({ where: { id } })) > 0;
  }
}
