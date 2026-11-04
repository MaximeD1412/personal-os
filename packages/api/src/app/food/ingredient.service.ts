import { Injectable } from '@nestjs/common';
import {
  normaliserLibelle,
  UNITES_AVEC_POIDS_A_LA_PIECE,
  type CanonicalUnit,
  type Ingredient,
  type IngredientInput,
  type IngredientListQuery,
  type IngredientUpdate,
} from '@personal-os/contracts';
import { ErreurMetier, Introuvable } from '../erreurs/erreur-metier';
import {
  IngredientRepository,
  type IngredientRecord,
  type IngredientWrite,
} from './ingredient.repository';
import { PantryItemRepository } from './pantry-item.repository';
import { ProductRepository } from './product.repository';

/**
 * Les saisies arrivent validées par leur schéma (ADR 0030) : il ne reste ici
 * que ce qu'un schéma ne peut pas juger seul. Un nom déjà pris, un poids à la
 * pièce sur un Ingrédient compté en millilitres (une modification peut n'en
 * porter qu'un des deux, l'autre est en base), une modification vide, un
 * Ingrédient introuvable, une Unité canonique qui changerait le sens d'une
 * quantité en stock ou d'un conditionnement, un Produit préféré qui n'est pas
 * l'un des siens.
 */
@Injectable()
export class IngredientService {
  constructor(
    private readonly repository: IngredientRepository,
    private readonly stock: PantryItemRepository,
    private readonly produits: ProductRepository,
  ) {}

  /** Tout le catalogue, ou les Ingrédients dont le nom contient chaque mot de `q`. */
  async lister({ q }: IngredientListQuery): Promise<Ingredient[]> {
    const mots = normaliserLibelle(q ?? '')
      .split(' ')
      .filter(Boolean);

    return (await this.repository.lister(mots)).map(exposer);
  }

  async lire(id: string): Promise<Ingredient> {
    return exposer(await this.existant(id));
  }

  async creer(saisie: IngredientInput): Promise<Ingredient> {
    verifierLePoidsALaPiece(saisie.canonicalUnit, saisie.gramsPerPiece);

    return exposer(
      await uniqueSinon(
        this.repository.creer({
          ...saisie,
          name: normaliserLibelle(saisie.displayName),
        }),
      ),
    );
  }

  async modifier(id: string, saisie: IngredientUpdate): Promise<Ingredient> {
    const changements = enChangements(saisie);

    if (Object.keys(changements).length === 0) {
      throw new ErreurMetier(
        'food.ingredient_empty_update',
        'La modification ne change rien.',
      );
    }

    const actuel = await this.existant(id);
    verifierLePoidsALaPiece(
      changements.canonicalUnit ?? actuel.canonicalUnit,
      changements.gramsPerPiece !== undefined
        ? changements.gramsPerPiece
        : actuel.gramsPerPiece,
    );
    if (
      changements.canonicalUnit !== undefined &&
      changements.canonicalUnit !== actuel.canonicalUnit &&
      (await this.stock.aDuStock(id))
    ) {
      // La ligne de stock compte dans l'unité de son Ingrédient : 1 000 g
      // deviendraient 1 000 pièces.
      throw new ErreurMetier(
        'food.ingredient_unit_in_stock',
        "L'Unité canonique ne change pas tant que l'Ingrédient a du stock : mettez sa ligne à zéro ou retirez-la d'abord.",
      );
    }
    if (
      changements.canonicalUnit !== undefined &&
      changements.canonicalUnit !== actuel.canonicalUnit &&
      (await this.produits.aDesProduits(id))
    ) {
      // La contenance d'un Produit compte dans l'unité de son Ingrédient :
      // une boîte de 400 g deviendrait une boîte de 400 pièces.
      throw new ErreurMetier(
        'food.ingredient_unit_has_products',
        "L'Unité canonique ne change pas tant que l'Ingrédient a des Produits : leur contenance compte dans cette unité. Retirez-les d'abord.",
      );
    }

    return exposer(
      await uniqueSinon(this.repository.modifier(id, changements)),
    );
  }

  /**
   * Pose le Produit préféré de l'Ingrédient, repris ensuite dans la liste de
   * courses, ou l'ôte (`null`). Il doit être l'un des siens.
   */
  async preferer(id: string, productId: string | null): Promise<Ingredient> {
    await this.existant(id);
    if (productId !== null) {
      const produit = await this.produits.lire(productId);
      if (produit?.ingredientId !== id) throw produitEtranger();
    }
    try {
      return exposer(await this.repository.preferer(id, productId));
    } catch (erreur) {
      // Le Produit a été retiré entre la vérification et l'écriture.
      if (codePrisma(erreur) === 'P2003') throw produitEtranger();
      if (codePrisma(erreur) === 'P2025') {
        throw new Introuvable(
          'food.ingredient_not_found',
          'Aucun Ingrédient de cet identifiant.',
        );
      }
      throw erreur;
    }
  }

  private async existant(id: string): Promise<IngredientRecord> {
    const ingredient = await this.repository.lire(id);
    if (!ingredient) {
      throw new Introuvable(
        'food.ingredient_not_found',
        'Aucun Ingrédient de cet identifiant.',
      );
    }
    return ingredient;
  }
}

/**
 * Un poids à la pièce relie des grammes et des pièces : il n'a pas de sens
 * pour un Ingrédient compté en millilitres.
 */
function verifierLePoidsALaPiece(
  unite: CanonicalUnit,
  grammesParPiece: number | null,
): void {
  if (
    grammesParPiece !== null &&
    !UNITES_AVEC_POIDS_A_LA_PIECE.includes(unite)
  ) {
    throw poidsNonApplicable();
  }
}

function produitEtranger(): ErreurMetier {
  return new ErreurMetier(
    'food.product_not_of_ingredient',
    "Ce Produit n'est pas l'un de ceux de cet Ingrédient : seul l'un des siens peut être préféré.",
  );
}

function poidsNonApplicable(): ErreurMetier {
  return new ErreurMetier(
    'food.grams_per_piece_not_applicable',
    'Un poids à la pièce ne vaut que pour un Ingrédient compté en grammes ou en pièces.',
  );
}

/**
 * Le nom normalisé est unique en base, et une contrainte y réserve le poids à
 * la pièce aux grammes et aux pièces : c'est elle qui tranche entre deux
 * saisies simultanées. Ses refus deviennent les règles du catalogue.
 */
async function uniqueSinon(
  operation: Promise<IngredientRecord>,
): Promise<IngredientRecord> {
  try {
    return await operation;
  } catch (erreur) {
    if (codePrisma(erreur) === 'P2002') {
      throw new ErreurMetier(
        'food.ingredient_duplicate',
        'Un Ingrédient du catalogue porte déjà ce nom.',
      );
    }
    if (violeLaContrainteDuPoids(erreur)) {
      throw poidsNonApplicable();
    }
    if (codePrisma(erreur) === 'P2025') {
      throw new Introuvable(
        'food.ingredient_not_found',
        'Aucun Ingrédient de cet identifiant.',
      );
    }
    throw erreur;
  }
}

/** Une modification ne porte que ce qu'elle change ; un libellé renomme. */
function enChangements(saisie: IngredientUpdate): Partial<IngredientWrite> {
  const changements: Partial<IngredientWrite> = {};

  if (saisie.displayName !== undefined) {
    changements.displayName = saisie.displayName;
    changements.name = normaliserLibelle(saisie.displayName);
  }
  if (saisie.canonicalUnit !== undefined) {
    changements.canonicalUnit = saisie.canonicalUnit;
  }
  if (saisie.gramsPerPiece !== undefined) {
    changements.gramsPerPiece = saisie.gramsPerPiece;
  }
  if (saisie.allergens !== undefined) {
    changements.allergens = saisie.allergens;
  }
  if (saisie.perishable !== undefined) {
    changements.perishable = saisie.perishable;
  }

  return changements;
}

/** Le refus de `Ingredient_gramsPerPiece_unit_check`, tel que Prisma le relaie. */
function violeLaContrainteDuPoids(erreur: unknown): boolean {
  if (codePrisma(erreur) !== 'P2039') {
    return false;
  }
  const cause = (
    erreur as {
      meta?: {
        driverAdapterError?: {
          cause?: { originalCode?: string; originalMessage?: string };
        };
      };
    }
  ).meta?.driverAdapterError?.cause;

  return (
    cause?.originalCode === '23514' &&
    (cause.originalMessage ?? '').includes(
      'Ingredient_gramsPerPiece_unit_check',
    )
  );
}

function codePrisma(erreur: unknown): unknown {
  return typeof erreur === 'object' && erreur !== null && 'code' in erreur
    ? erreur.code
    : undefined;
}

function exposer(ingredient: IngredientRecord): Ingredient {
  return {
    id: ingredient.id,
    name: ingredient.name,
    displayName: ingredient.displayName,
    canonicalUnit: ingredient.canonicalUnit,
    gramsPerPiece: ingredient.gramsPerPiece,
    allergens: ingredient.allergens,
    perishable: ingredient.perishable,
    preferredProductId: ingredient.preferredProductId,
    createdAt: ingredient.createdAt.toISOString(),
  };
}
