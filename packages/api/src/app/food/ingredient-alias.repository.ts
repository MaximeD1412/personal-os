import { Injectable } from '@nestjs/common';
import { PrismaService } from '@personal-os/database';
import type { Catalogue } from './resolution/resoudre';

export interface IngredientAliasRecord {
  id: string;
  label: string;
  ingredientId: string;
  createdAt: Date;
}

/**
 * `IngredientAlias` est hors Espace (`MODELES_HORS_ESPACE`), comme le
 * catalogue qu'il complète : aucun filtre d'Espace n'a de sens ici.
 */
@Injectable()
export class IngredientAliasRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tout ce que le résolveur compare : les noms et les Alias. Le catalogue est
   * borné par nature (quelques centaines d'Ingrédients).
   */
  async catalogue(): Promise<Catalogue> {
    const [ingredients, alias] = await Promise.all([
      this.prisma.ingredient.findMany({ select: { id: true, name: true } }),
      this.prisma.ingredientAlias.findMany({
        select: { label: true, ingredientId: true },
      }),
    ]);

    return { ingredients, alias };
  }

  async lire(label: string): Promise<IngredientAliasRecord | null> {
    return this.prisma.ingredientAlias.findUnique({ where: { label } });
  }

  /** L'Ingrédient dont le nom normalisé est ce libellé, s'il y en a un. */
  async ingredientNomme(name: string): Promise<{ id: string } | null> {
    return this.prisma.ingredient.findUnique({
      where: { name },
      select: { id: true },
    });
  }

  async ingredientExiste(id: string): Promise<boolean> {
    return (await this.prisma.ingredient.count({ where: { id } })) > 0;
  }

  async creer(saisie: {
    label: string;
    ingredientId: string;
  }): Promise<IngredientAliasRecord> {
    return this.prisma.ingredientAlias.create({ data: saisie });
  }
}
