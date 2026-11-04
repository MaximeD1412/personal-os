import { Injectable } from '@nestjs/common';
import type { Allergen, CanonicalUnit } from '@personal-os/contracts';
import { PrismaService } from '@personal-os/database';

export interface IngredientRecord {
  id: string;
  name: string;
  displayName: string;
  canonicalUnit: CanonicalUnit;
  gramsPerPiece: number | null;
  allergens: Allergen[];
  perishable: boolean;
  createdAt: Date;
}

/** Ce qu'une écriture pose : la saisie du contrat, et le nom qu'on en déduit. */
export interface IngredientWrite {
  name: string;
  displayName: string;
  canonicalUnit: CanonicalUnit;
  gramsPerPiece: number | null;
  allergens: Allergen[];
  perishable: boolean;
}

/** La rangée telle que Prisma la rend : le poids à la pièce y est un décimal. */
type RangeeIngredient = Omit<IngredientRecord, 'gramsPerPiece'> & {
  gramsPerPiece: { toNumber(): number } | null;
};

/**
 * `Ingredient` est hors Espace (`MODELES_HORS_ESPACE`) : la garde le laisse
 * passer, et aucun filtre d'Espace n'a de sens ici.
 */
@Injectable()
export class IngredientRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Les Ingrédients dont le nom contient chacun des mots, tous sans mots. */
  async lister(mots: readonly string[]): Promise<IngredientRecord[]> {
    const rangees = await this.prisma.ingredient.findMany({
      where: { AND: mots.map((mot) => ({ name: { contains: mot } })) },
      orderBy: { name: 'asc' },
    });

    return rangees.map(enIngredient);
  }

  async lire(id: string): Promise<IngredientRecord | null> {
    const rangee = await this.prisma.ingredient.findUnique({ where: { id } });

    return rangee ? enIngredient(rangee) : null;
  }

  async creer(saisie: IngredientWrite): Promise<IngredientRecord> {
    return enIngredient(await this.prisma.ingredient.create({ data: saisie }));
  }

  async modifier(
    id: string,
    saisie: Partial<IngredientWrite>,
  ): Promise<IngredientRecord> {
    return enIngredient(
      await this.prisma.ingredient.update({ where: { id }, data: saisie }),
    );
  }
}

function enIngredient(rangee: RangeeIngredient): IngredientRecord {
  return {
    ...rangee,
    gramsPerPiece: rangee.gramsPerPiece?.toNumber() ?? null,
  };
}
