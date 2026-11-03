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
 * Ce que vaut une unité de recette dans l'Unité canonique de l'Ingrédient,
 * en fraction exacte (`facteur / diviseur`) : passer des grammes aux pièces
 * divise par le poids à la pièce, et une division décimale arrondit. Masse et
 * volume se convertissent dans leur dimension ; les pièces et les grammes
 * passent de l'une à l'autre par le poids à la pièce validé sur l'Ingrédient ;
 * un volume et une masse jamais (pas de densité). Plutôt que d'approximer, la
 * conversion échoue et dit pourquoi.
 */
export function facteurDeConversion(
  unite: RecipeUnit,
  ingredient: IngredientAConvertir,
): { facteur: Decimal; diviseur: Decimal } | { echec: EchecDeConversion } {
  const source = UNITES[unite];
  const cible = DIMENSION_CANONIQUE[ingredient.canonicalUnit];
  const un = new Decimal(1);

  if (source.dimension === cible)
    return { facteur: source.facteur, diviseur: un };

  const entrePiecesEtGrammes =
    (source.dimension === 'piece' && cible === 'masse') ||
    (source.dimension === 'masse' && cible === 'piece');
  if (!entrePiecesEtGrammes) return { echec: 'dimension' };

  if (ingredient.gramsPerPiece === null) return { echec: 'facteur_manquant' };
  const grammesParPiece = new Decimal(ingredient.gramsPerPiece);
  if (!grammesParPiece.greaterThan(0)) return { echec: 'facteur_manquant' };

  return cible === 'masse'
    ? { facteur: source.facteur.times(grammesParPiece), diviseur: un }
    : { facteur: source.facteur, diviseur: grammesParPiece };
}

/** Ramène une quantité de recette à l'Unité canonique de l'Ingrédient (voir `facteurDeConversion`). */
export function convertir(
  { quantite, unite }: QuantiteDeRecette,
  ingredient: IngredientAConvertir,
): Conversion {
  const conversion = facteurDeConversion(unite, ingredient);
  if ('echec' in conversion) return conversion;
  return {
    quantite: new Decimal(quantite)
      .times(conversion.facteur)
      .dividedBy(conversion.diviseur),
  };
}
