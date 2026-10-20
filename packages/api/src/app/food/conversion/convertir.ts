import Decimal from 'decimal.js';
import type { CanonicalUnit, RecipeUnit } from '@personal-os/contracts';

/** Une quantité telle qu'une recette la donne. */
export interface QuantiteDeRecette {
  quantite: Decimal.Value;
  unite: RecipeUnit;
}

/** Ce que la conversion lit d'un Ingrédient. */
export interface IngredientAConvertir {
  canonicalUnit: CanonicalUnit;
  gramsPerPiece: Decimal.Value | null;
}

/**
 * `dimension` : l'unité de recette ne se mesure pas comme l'Unité canonique
 * (un volume pour un Ingrédient en grammes). `facteur_manquant` : il faudrait
 * le poids à la pièce, et l'Ingrédient n'en a pas.
 */
export type EchecDeConversion = 'dimension' | 'facteur_manquant';

export type Conversion = { quantite: Decimal } | { echec: EchecDeConversion };

type Dimension = 'masse' | 'volume' | 'piece';

/** Chaque unité de recette, sa dimension et ce qu'elle vaut en g, ml ou pièces. */
const UNITES: Readonly<
  Record<RecipeUnit, { dimension: Dimension; facteur: Decimal }>
> = {
  G: { dimension: 'masse', facteur: new Decimal(1) },
  KG: { dimension: 'masse', facteur: new Decimal(1000) },
  MG: { dimension: 'masse', facteur: new Decimal('0.001') },
  ML: { dimension: 'volume', facteur: new Decimal(1) },
  CL: { dimension: 'volume', facteur: new Decimal(10) },
  L: { dimension: 'volume', facteur: new Decimal(1000) },
  TSP: { dimension: 'volume', facteur: new Decimal(5) },
  TBSP: { dimension: 'volume', facteur: new Decimal(15) },
  PIECE: { dimension: 'piece', facteur: new Decimal(1) },
};

const DIMENSION_CANONIQUE: Readonly<Record<CanonicalUnit, Dimension>> = {
  GRAM: 'masse',
  MILLILITER: 'volume',
  PIECE: 'piece',
};

/**
 * Ramène une quantité de recette à l'Unité canonique de l'Ingrédient, en
 * décimal exact. Masse et volume se convertissent dans leur dimension ; les
 * pièces et les grammes passent de l'une à l'autre par le poids à la pièce
 * validé sur l'Ingrédient ; un volume et une masse jamais (pas de densité).
 * Plutôt que d'approximer, la conversion échoue et dit pourquoi.
 */
export function convertir(
  { quantite, unite }: QuantiteDeRecette,
  ingredient: IngredientAConvertir,
): Conversion {
  const source = UNITES[unite];
  const cible = DIMENSION_CANONIQUE[ingredient.canonicalUnit];
  const enBase = new Decimal(quantite).times(source.facteur);

  if (source.dimension === cible) return { quantite: enBase };

  const entrePiecesEtGrammes =
    (source.dimension === 'piece' && cible === 'masse') ||
    (source.dimension === 'masse' && cible === 'piece');
  if (!entrePiecesEtGrammes) return { echec: 'dimension' };

  if (ingredient.gramsPerPiece === null) return { echec: 'facteur_manquant' };
  const grammesParPiece = new Decimal(ingredient.gramsPerPiece);
  if (!grammesParPiece.greaterThan(0)) return { echec: 'facteur_manquant' };

  return {
    quantite:
      cible === 'masse'
        ? enBase.times(grammesParPiece)
        : enBase.dividedBy(grammesParPiece),
  };
}
