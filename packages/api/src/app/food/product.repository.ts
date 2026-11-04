import { Injectable } from '@nestjs/common';
import type { ProductForm } from '@personal-os/contracts';
import { PrismaService } from '@personal-os/database';

export interface ProductRecord {
  id: string;
  ingredientId: string;
  brand: string | null;
  form: ProductForm;
  packageQuantity: number;
  packageLabel: string;
  createdAt: Date;
}

/** Ce qu'une écriture pose ; la contenance en texte, sans flottant. */
export interface ProductWrite {
  brand: string | null;
  form: ProductForm;
  packageQuantity: string;
  packageLabel: string;
}

/** La rangée telle que Prisma la rend : la contenance y est un décimal. */
type RangeeProduit = Omit<ProductRecord, 'packageQuantity'> & {
  packageQuantity: { toNumber(): number };
};

const CHAMPS = {
  id: true,
  ingredientId: true,
  brand: true,
  form: true,
  packageQuantity: true,
  packageLabel: true,
  createdAt: true,
} as const;

/**
 * `Product` est hors Espace (`MODELES_HORS_ESPACE`), comme le catalogue
 * d'Ingrédients : la garde le laisse passer, et aucun filtre d'Espace n'a de
 * sens ici.
 */
@Injectable()
export class ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Les Produits d'un Ingrédient, dans l'ordre où on les a ajoutés. */
  async lister(ingredientId: string): Promise<ProductRecord[]> {
    const rangees = await this.prisma.product.findMany({
      where: { ingredientId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: CHAMPS,
    });
    return rangees.map(enProduit);
  }

  async lire(id: string): Promise<ProductRecord | null> {
    const rangee = await this.prisma.product.findUnique({
      where: { id },
      select: CHAMPS,
    });
    return rangee ? enProduit(rangee) : null;
  }

  async aDesProduits(ingredientId: string): Promise<boolean> {
    return (await this.prisma.product.count({ where: { ingredientId } })) > 0;
  }

  async creer(
    ingredientId: string,
    saisie: ProductWrite,
  ): Promise<ProductRecord> {
    return enProduit(
      await this.prisma.product.create({
        data: { ...saisie, ingredientId },
        select: CHAMPS,
      }),
    );
  }

  async modifier(
    id: string,
    saisie: Partial<ProductWrite>,
  ): Promise<ProductRecord> {
    return enProduit(
      await this.prisma.product.update({
        where: { id },
        data: saisie,
        select: CHAMPS,
      }),
    );
  }

  /**
   * Le nombre de Produits retirés : aucun s'il était absent. Son Ingrédient
   * n'a plus de Produit préféré s'il l'était, et les listes déjà produites
   * gardent leur conditionnement (ADR 0012) : la base ne fait qu'oublier
   * leur lien vers lui.
   */
  async supprimer(id: string): Promise<number> {
    const { count } = await this.prisma.product.deleteMany({ where: { id } });
    return count;
  }
}

function enProduit(rangee: RangeeProduit): ProductRecord {
  return { ...rangee, packageQuantity: rangee.packageQuantity.toNumber() };
}
