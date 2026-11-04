import { Injectable } from '@nestjs/common';
import type {
  Product,
  ProductInput,
  ProductUpdate,
} from '@personal-os/contracts';
import { ErreurMetier, Introuvable } from '../erreurs/erreur-metier';
import { IngredientRepository } from './ingredient.repository';
import {
  ProductRepository,
  type ProductRecord,
  type ProductWrite,
} from './product.repository';
import { codePrisma } from './shopping-list.repository';

/**
 * Les Produits du catalogue (CUISINE-12). Les saisies arrivent validées par
 * leur schéma (ADR 0030) ; il reste ici ce qu'un schéma ne juge pas seul : un
 * Ingrédient ou un Produit introuvable, une modification vide.
 */
@Injectable()
export class ProductService {
  constructor(
    private readonly repository: ProductRepository,
    private readonly ingredients: IngredientRepository,
  ) {}

  async lister(ingredientId: string): Promise<Product[]> {
    if (!(await this.ingredients.lire(ingredientId))) {
      throw new Introuvable(
        'food.ingredient_not_found',
        'Aucun Ingrédient de cet identifiant.',
      );
    }
    return (await this.repository.lister(ingredientId)).map(exposer);
  }

  async creer({ ingredientId, ...saisie }: ProductInput): Promise<Product> {
    try {
      return exposer(
        await this.repository.creer(ingredientId, {
          ...saisie,
          packageQuantity: String(saisie.packageQuantity),
        }),
      );
    } catch (erreur) {
      if (codePrisma(erreur) === 'P2003') {
        throw new ErreurMetier(
          'food.unknown_ingredient',
          "Cet Ingrédient n'est pas au catalogue.",
        );
      }
      throw erreur;
    }
  }

  async modifier(id: string, saisie: ProductUpdate): Promise<Product> {
    const changements = enEcriture(saisie);
    if (Object.keys(changements).length === 0) {
      throw new ErreurMetier(
        'food.product_empty_update',
        'La modification ne change rien.',
      );
    }
    try {
      return exposer(await this.repository.modifier(id, changements));
    } catch (erreur) {
      if (codePrisma(erreur) === 'P2025') throw produitIntrouvable();
      throw erreur;
    }
  }

  async supprimer(id: string): Promise<void> {
    if ((await this.repository.supprimer(id)) === 0) {
      throw produitIntrouvable();
    }
  }
}

export function produitIntrouvable(): Introuvable {
  return new Introuvable(
    'food.product_not_found',
    'Aucun Produit de cet identifiant.',
  );
}

/** Ne garde que ce que la saisie porte ; la contenance part en texte. */
function enEcriture(saisie: ProductUpdate): Partial<ProductWrite> {
  const { packageQuantity, ...reste } = saisie;
  const ecriture: Partial<ProductWrite> = Object.fromEntries(
    Object.entries(reste).filter(([, valeur]) => valeur !== undefined),
  );
  if (packageQuantity !== undefined) {
    ecriture.packageQuantity = String(packageQuantity);
  }
  return ecriture;
}

function exposer(produit: ProductRecord): Product {
  return { ...produit, createdAt: produit.createdAt.toISOString() };
}
