import Decimal from 'decimal.js';
import {
  facteurDeConversion,
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
  const besoins = new Map<string, Rationnel>();
  const echecs = new Map<string, EchecDeConversion>();

  for (const { recipeId, portions } of repas) {
    if (recipeId === null) continue;
    const recette = connu(recetteDe, recipeId, 'Recette');

    for (const { ingredientId, quantite, unite } of recette.lignes) {
      const conversion = facteurDeConversion(
        unite,
        connu(ingredientDe, ingredientId, 'Ingrédient'),
      );
      if ('echec' in conversion) {
        if (!echecs.has(ingredientId))
          echecs.set(ingredientId, conversion.echec);
        continue;
      }
      // quantité × portions × facteur / (portions de référence × diviseur)
      const besoin = diviser(
        multiplier(
          rationnel(new Decimal(quantite).times(portions)),
          rationnel(conversion.facteur),
        ),
        multiplier(rationnel(recette.servings), rationnel(conversion.diviseur)),
      );
      besoins.set(
        ingredientId,
        additionner(besoins.get(ingredientId) ?? rationnel(0), besoin),
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
      rationnel(quantite),
    ]),
  );
  const articles: ArticleConsolide[] = [];
  for (const [ingredientId, besoin] of besoins) {
    const reste = soustraire(besoin, enStock.get(ingredientId) ?? rationnel(0));
    if (reste.numerateur > ZERO) {
      articles.push({ ingredientId, quantite: auMillemeSuperieur(reste) });
    }
  }
  return { articles };
}

/**
 * Une fraction exacte d'entiers, dénominateur positif. Les quantités d'une
 * recette, du stock et du poids à la pièce sont des décimaux finis, mais
 * diviser par les portions de référence ou par le poids à la pièce ne l'est
 * pas : 5 g pour 3 portions, trois fois, font 5 g tout juste, et non un
 * résidu qu'arrondir au supérieur transformerait en achat.
 */
interface Rationnel {
  numerateur: bigint;
  denominateur: bigint;
}

const ZERO = BigInt(0);
const MILLE = BigInt(1000);

function rationnel(valeur: Decimal.Value): Rationnel {
  const [n, d] = new Decimal(valeur).toFraction();
  return reduire(BigInt(n.toFixed()), BigInt(d.toFixed()));
}

function pgcd(a: bigint, b: bigint): bigint {
  let [x, y] = [a < ZERO ? -a : a, b];
  while (y !== ZERO) [x, y] = [y, x % y];
  return x;
}

function reduire(numerateur: bigint, denominateur: bigint): Rationnel {
  const signe = denominateur < ZERO ? -BigInt(1) : BigInt(1);
  const commun = pgcd(
    numerateur,
    denominateur < ZERO ? -denominateur : denominateur,
  );
  return {
    numerateur: (signe * numerateur) / commun,
    denominateur: (signe * denominateur) / commun,
  };
}

function multiplier(a: Rationnel, b: Rationnel): Rationnel {
  return reduire(a.numerateur * b.numerateur, a.denominateur * b.denominateur);
}

function diviser(a: Rationnel, b: Rationnel): Rationnel {
  return reduire(a.numerateur * b.denominateur, a.denominateur * b.numerateur);
}

function additionner(a: Rationnel, b: Rationnel): Rationnel {
  return reduire(
    a.numerateur * b.denominateur + b.numerateur * a.denominateur,
    a.denominateur * b.denominateur,
  );
}

function soustraire(a: Rationnel, b: Rationnel): Rationnel {
  return additionner(a, {
    numerateur: -b.numerateur,
    denominateur: b.denominateur,
  });
}

/** Une quantité positive, arrondie au millième supérieur : on n'achète pas moins que le besoin. */
function auMillemeSuperieur({ numerateur, denominateur }: Rationnel): Decimal {
  const milliemes = numerateur * MILLE;
  const quotient =
    milliemes / denominateur +
    (milliemes % denominateur === ZERO ? ZERO : BigInt(1));
  return new Decimal(quotient.toString()).dividedBy(1000);
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
