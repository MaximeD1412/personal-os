import Decimal from 'decimal.js';
import {
  convertir,
  type EchecDeConversion,
  type IngredientAConvertir,
  type QuantiteDeRecette,
} from '../conversion/convertir';

/** Un Repas planifié tel que la consolidation le lit : sa recette, s'il en a une, et ses portions. */
export interface RepasAConsolider {
  recipeId: string | null;
  portions: number;
}

export interface RecetteAConsolider {
  id: string;
  /** Les portions de référence de la recette. */
  servings: number;
  lignes: readonly (QuantiteDeRecette & { ingredientId: string })[];
}

/** Une ligne du Stock domestique, déjà en Unité canonique. */
export interface StockAConsolider {
  ingredientId: string;
  quantite: Decimal.Value;
}

export interface IngredientAConsolider extends IngredientAConvertir {
  id: string;
}

/** Un besoin qui reste à acheter, en Unité canonique, au millième. */
export interface ArticleConsolide {
  ingredientId: string;
  quantite: Decimal;
}

export interface EchecDeConsolidation {
  ingredientId: string;
  raison: EchecDeConversion;
}

export type Consolidation =
  | { articles: ArticleConsolide[] }
  | { echecs: EchecDeConsolidation[] };

/**
 * Les besoins d'un Planning de repas, consolidés par Ingrédient en Unité
 * canonique, moins le Stock domestique. Chaque repas avec recette en demande
 * les quantités à l'échelle de ses portions ; un repas sans recette (un
 * intitulé) ne demande rien. Un besoin couvert par le stock ne donne pas
 * d'article. Une seule conversion impossible fait échouer l'ensemble : une
 * liste partielle ferait oublier un Ingrédient au magasin.
 *
 * Les articles suivent l'ordre où leur Ingrédient apparaît pour la première
 * fois. Le calcul est exact ; seule la quantité restante s'arrondit, au
 * millième supérieur, celui que la base garde : on n'achète pas moins que le
 * besoin.
 */
export function consolider(
  repas: readonly RepasAConsolider[],
  recettes: readonly RecetteAConsolider[],
  stock: readonly StockAConsolider[],
  ingredients: readonly IngredientAConsolider[],
): Consolidation {
  const recetteDe = new Map(recettes.map((recette) => [recette.id, recette]));
  const ingredientDe = new Map(
    ingredients.map((ingredient) => [ingredient.id, ingredient]),
  );
  const besoins = new Map<string, Decimal>();
  const echecs = new Map<string, EchecDeConversion>();

  for (const { recipeId, portions } of repas) {
    if (recipeId === null) continue;
    const recette = connu(recetteDe, recipeId, 'Recette');

    for (const { ingredientId, quantite, unite } of recette.lignes) {
      const conversion = convertir(
        // Multiplier avant de diviser : la division seule arrondit.
        {
          quantite: new Decimal(quantite)
            .times(portions)
            .dividedBy(recette.servings),
          unite,
        },
        connu(ingredientDe, ingredientId, 'Ingrédient'),
      );
      if ('echec' in conversion) {
        if (!echecs.has(ingredientId))
          echecs.set(ingredientId, conversion.echec);
        continue;
      }
      besoins.set(
        ingredientId,
        (besoins.get(ingredientId) ?? new Decimal(0)).plus(conversion.quantite),
      );
    }
  }

  if (echecs.size > 0) {
    return {
      echecs: [...echecs].map(([ingredientId, raison]) => ({
        ingredientId,
        raison,
      })),
    };
  }

  const enStock = new Map(
    stock.map(({ ingredientId, quantite }) => [
      ingredientId,
      new Decimal(quantite),
    ]),
  );
  const articles: ArticleConsolide[] = [];
  for (const [ingredientId, besoin] of besoins) {
    const reste = besoin
      .minus(enStock.get(ingredientId) ?? 0)
      .toDecimalPlaces(3, Decimal.ROUND_UP);
    if (reste.greaterThan(0)) articles.push({ ingredientId, quantite: reste });
  }
  return { articles };
}

/** Un repas qui cite une recette absente des données est un défaut de l'appelant. */
function connu<T>(
  index: ReadonlyMap<string, T>,
  id: string,
  nature: string,
): T {
  const trouve = index.get(id);
  if (trouve === undefined) {
    throw new RangeError(`${nature} ${id} absent des données à consolider.`);
  }
  return trouve;
}
