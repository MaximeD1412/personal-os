import { Injectable } from '@nestjs/common';
import {
  portions,
  type ApiFieldError,
  type ShoppingGap,
  type ShoppingList,
  type ShoppingListItem,
  type ShoppingListItemInput,
  type ShoppingListProductionQuery,
  type ShoppingListQuery,
} from '@personal-os/contracts';
import type Decimal from 'decimal.js';
import { ErreurMetier, Introuvable } from '../erreurs/erreur-metier';
import type { EchecDeConversion } from './conversion/convertir';
import { consolider, type EchecDeConsolidation } from './courses/consolider';
import { ecart } from './courses/ecart';
import {
  codePrisma,
  ShoppingListRepository,
  type IngredientAConsoliderRecord,
  type PlanningAConsoliderRecord,
  type ShoppingListItemRecord,
  type ShoppingListRecord,
} from './shopping-list.repository';

/** Combien de fois un complément recalcule son écart quand un autre est passé avant lui. */
const ESSAIS_DE_COMPLEMENT = 5;

/**
 * Les Listes de courses du Foyer, figées à leur production (ADR 0012) : rien
 * ne les recalcule. Les saisies arrivent validées par leur schéma (ADR 0030) ;
 * il reste ici ce qu'un schéma ne juge pas seul. Un planning qui n'est pas
 * arrêté, un complément sans rien qui manque, un Ingrédient qui ne se convertit pas, un Ingrédient inconnu, une
 * liste close, un article du planning qu'on voudrait retirer.
 */
@Injectable()
export class ShoppingListService {
  constructor(private readonly repository: ShoppingListRepository) {}

  async lister({ status }: ShoppingListQuery): Promise<ShoppingList[]> {
    return (await this.repository.lister(status)).map(exposer);
  }

  async lire(id: string): Promise<ShoppingList> {
    return exposer(await this.liste(id));
  }

  /**
   * Produit une liste depuis un planning arrêté : ses besoins, consolidés par
   * Ingrédient en Unité canonique, moins le Stock domestique. Produire de
   * nouveau depuis le même planning crée une autre liste. Une liste de
   * complément ne porte que l'écart avec les listes déjà produites pour lui.
   */
  async produire(
    planId: string,
    { complement = false }: ShoppingListProductionQuery = {},
  ): Promise<ShoppingList> {
    for (let essai = 1; ; essai++) {
      const planning = await this.planningArrete(planId);
      const { besoins, listesLues } = complement
        ? await this.manquants(planning)
        : { besoins: await this.besoinActuel(planning), listesLues: undefined };
      if (complement && besoins.length === 0) {
        throw new ErreurMetier(
          'food.no_shopping_gap',
          "Rien ne manque aux listes déjà produites pour ce planning : il n'y a pas de liste de complément à produire.",
        );
      }

      const articles = besoins.map(({ ingredient, quantite }) => ({
        ingredientId: ingredient.id,
        label: null,
        quantity: quantite.toFixed(3),
        unit: ingredient.canonicalUnit,
      }));

      try {
        return exposer(
          await this.repository.produire(planId, articles, listesLues),
        );
      } catch (erreur) {
        if (codePrisma(erreur) !== 'P2025') {
          throw erreur;
        }
        // Le planning a été rouvert depuis qu'on l'a lu.
        await this.planningArrete(planId);
        // Sinon, un autre complément est passé avant : l'écart se recalcule.
        if (!complement || essai === ESSAIS_DE_COMPLEMENT) throw erreur;
      }
    }
  }

  /**
   * L'écart entre un planning et ses listes figées (ADR 0012) : ce que sa
   * consolidation actuelle exige au-delà de ce qu'elles couvrent. Un planning
   * ouvert a aussi un écart : on le voit pendant qu'on le modifie.
   */
  async lireLEcart(planId: string): Promise<ShoppingGap> {
    const { besoins } = await this.manquants(await this.planning(planId));
    return {
      missing: besoins.map(({ ingredient, quantite }) => ({
        ingredient: { id: ingredient.id, displayName: ingredient.displayName },
        quantity: quantite.toNumber(),
        unit: ingredient.canonicalUnit,
      })),
    };
  }

  /**
   * Les besoins du planning qu'aucune liste déjà produite pour lui ne couvre,
   * et ces listes. Sans liste, il n'y a pas d'écart : le planning attend sa
   * première liste.
   */
  private async manquants(
    planning: PlanningAConsoliderRecord,
  ): Promise<{ besoins: Besoin[]; listesLues: string[] }> {
    const listes = await this.repository.listesDuPlanning(planning.id);
    const listesLues = listes.map(({ id }) => id);
    if (listes.length === 0) return { besoins: [], listesLues };

    const besoins = await this.besoinActuel(planning);
    const { manquants } = ecart(
      besoins.map(({ ingredient, quantite }) => ({
        ingredientId: ingredient.id,
        quantite,
        unite: ingredient.canonicalUnit,
      })),
      listes.map(({ items }) => ({
        articles: items.map(({ ingredientId, quantity, unit, origin }) => ({
          ingredientId,
          quantite: quantity?.toString() ?? null,
          unite: unit,
          origin,
        })),
      })),
    );
    const ingredientDe = new Map(
      besoins.map(({ ingredient }) => [ingredient.id, ingredient]),
    );
    return {
      besoins: manquants.map(({ ingredientId, quantite }) => ({
        ingredient: ingredientDe.get(
          ingredientId,
        ) as IngredientAConsoliderRecord,
        quantite,
      })),
      listesLues,
    };
  }

  /**
   * La consolidation actuelle du planning, dans l'ordre alphabétique où une
   * liste se lit au magasin. Une conversion impossible la refuse entière.
   */
  private async besoinActuel(
    planning: PlanningAConsoliderRecord,
  ): Promise<Besoin[]> {
    const ingredients = ingredientsDe(planning);
    const stock = await this.repository.stockDe([...ingredients.keys()]);

    const consolidation = consolider(
      planning.entries.map((repas) => ({
        recipeId: repas.recipe?.id ?? null,
        portions: portions(repas),
      })),
      planning.entries.flatMap(({ recipe }) =>
        recipe
          ? [
              {
                id: recipe.id,
                servings: recipe.servings,
                lignes: recipe.lines.map(({ quantity, unit, ingredient }) => ({
                  ingredientId: ingredient.id,
                  quantite: quantity.toString(),
                  unite: unit,
                })),
              },
            ]
          : [],
      ),
      stock.map(({ ingredientId, quantity }) => ({
        ingredientId,
        quantite: quantity.toString(),
      })),
      [...ingredients.values()].map(({ id, canonicalUnit, gramsPerPiece }) => ({
        id,
        canonicalUnit,
        gramsPerPiece: gramsPerPiece?.toString() ?? null,
      })),
    );

    if ('echecs' in consolidation) {
      throw conversionImpossible(consolidation.echecs, ingredients);
    }

    return consolidation.articles
      .map(({ ingredientId, quantite }) => ({
        ingredient: ingredients.get(
          ingredientId,
        ) as IngredientAConsoliderRecord,
        quantite,
      }))
      .sort((a, b) => a.ingredient.name.localeCompare(b.ingredient.name, 'fr'));
  }

  /**
   * Un ajout manuel : un Ingrédient du catalogue, dont la quantité est en
   * Unité canonique, ou un simple libellé, qui se compte.
   */
  async ajouter(
    listeId: string,
    { ingredientId, label, quantity }: ShoppingListItemInput,
  ): Promise<ShoppingListItem> {
    await this.listeOuverte(listeId);

    let unit = null;
    if (ingredientId !== undefined) {
      unit = await this.repository.uniteDe(ingredientId);
      if (unit === null) {
        throw ingredientInconnu();
      }
    }

    return exposerLArticle(
      await this.ecrire(
        this.repository.ajouter(listeId, {
          ingredientId: ingredientId ?? null,
          label: label ?? null,
          quantity: quantity === undefined ? null : String(quantity),
          unit: quantity === undefined ? null : unit,
        }),
        listeId,
      ),
    );
  }

  async cocher(
    listeId: string,
    id: string,
    checked: boolean,
  ): Promise<ShoppingListItem> {
    this.article(await this.listeOuverte(listeId), id);

    return exposerLArticle(
      await this.ecrire(
        this.repository.cocher(listeId, id, checked),
        listeId,
        id,
      ),
    );
  }

  /** Seul un ajout manuel se retire : un article du planning est figé avec la liste. */
  async supprimer(listeId: string, id: string): Promise<void> {
    const verifier = async () => {
      const article = this.article(await this.listeOuverte(listeId), id);
      if (article.origin !== 'MANUAL') {
        throw new ErreurMetier(
          'food.item_not_manual',
          'Cet article vient du planning : seul un ajout manuel se retire de la liste.',
        );
      }
    };
    await verifier();

    if (
      (await this.ecrire(
        this.repository.supprimerUnAjout(listeId, id),
        listeId,
      )) === 0
    ) {
      await verifier();
      throw articleIntrouvable();
    }
  }

  private async liste(id: string): Promise<ShoppingListRecord> {
    const liste = await this.repository.lire(id);
    if (!liste) {
      throw new Introuvable(
        'food.list_not_found',
        'Aucune Liste de courses de cet identifiant.',
      );
    }
    return liste;
  }

  private async listeOuverte(id: string): Promise<ShoppingListRecord> {
    const liste = await this.liste(id);
    if (liste.status !== 'OPEN') {
      throw new ErreurMetier(
        'food.list_already_closed',
        'Cette Liste de courses est close : elle ne se modifie plus.',
      );
    }
    return liste;
  }

  private article(
    liste: ShoppingListRecord,
    id: string,
  ): ShoppingListItemRecord {
    const article = liste.items.find((item) => item.id === id);
    if (!article) {
      throw articleIntrouvable();
    }
    return article;
  }

  private async planning(id: string): Promise<PlanningAConsoliderRecord> {
    const planning = await this.repository.planningAConsolider(id);
    if (!planning) {
      throw new Introuvable(
        'food.plan_not_found',
        'Aucun Planning de repas de cet identifiant.',
      );
    }
    return planning;
  }

  private async planningArrete(id: string): Promise<PlanningAConsoliderRecord> {
    const planning = await this.planning(id);
    if (planning.status !== 'STOPPED') {
      throw new ErreurMetier(
        'food.plan_not_stopped',
        "Ce planning n'est pas arrêté : arrêtez-le pour en produire la liste de courses.",
      );
    }
    return planning;
  }

  /**
   * Une écriture échoue si la liste a été close, ou l'article retiré, depuis
   * qu'on les a lus : on relit pour dire lequel. Un Ingrédient retiré du
   * catalogue entre la vérification et l'écriture cède sur sa clé étrangère.
   */
  private async ecrire<T>(
    operation: Promise<T>,
    listeId: string,
    articleId?: string,
  ): Promise<T> {
    try {
      return await operation;
    } catch (erreur) {
      if (codePrisma(erreur) === 'P2003') {
        throw ingredientInconnu();
      }
      if (codePrisma(erreur) !== 'P2025') {
        throw erreur;
      }
      const liste = await this.listeOuverte(listeId);
      if (articleId !== undefined) {
        this.article(liste, articleId);
      }
      throw erreur;
    }
  }
}

/** Un besoin à acheter, en Unité canonique de son Ingrédient. */
interface Besoin {
  ingredient: IngredientAConsoliderRecord;
  quantite: Decimal;
}

/** Chaque Ingrédient que les recettes du planning citent, une fois. */
function ingredientsDe(
  planning: PlanningAConsoliderRecord,
): Map<string, IngredientAConsoliderRecord> {
  return new Map(
    planning.entries.flatMap(({ recipe }) =>
      (recipe?.lines ?? []).map(({ ingredient }) => [
        ingredient.id,
        ingredient,
      ]),
    ),
  );
}

const RAISONS: Readonly<Record<EchecDeConversion, string>> = {
  dimension:
    'une recette le donne dans une unité qui ne se mesure pas comme son Unité canonique (un volume pour des grammes)',
  facteur_manquant:
    'il faudrait son poids à la pièce pour passer des pièces aux grammes, et il ne l’a pas',
};

/** Aucune liste partielle : l'échec nomme chaque Ingrédient en cause, dans `fields`. */
function conversionImpossible(
  echecs: readonly EchecDeConsolidation[],
  ingredients: ReadonlyMap<string, IngredientAConsoliderRecord>,
): ErreurMetier {
  const champs: ApiFieldError[] = echecs.map(({ ingredientId, raison }) => ({
    path: ingredientId,
    code: raison,
    message: `${ingredients.get(ingredientId)?.displayName ?? ingredientId} : ${RAISONS[raison]}.`,
  }));
  return new ErreurMetier(
    'food.conversion_missing',
    `Aucune liste n'est produite : ${echecs.length === 1 ? 'un Ingrédient ne se convertit' : `${echecs.length} Ingrédients ne se convertissent`} pas en Unité canonique.`,
    422,
    champs,
  );
}

function ingredientInconnu(): ErreurMetier {
  return new ErreurMetier(
    'food.unknown_ingredient',
    "Cet Ingrédient n'est pas au catalogue.",
  );
}

function articleIntrouvable(): Introuvable {
  return new Introuvable(
    'food.item_not_found',
    'Aucun Article de cet identifiant dans cette liste.',
  );
}

function exposerLArticle(article: ShoppingListItemRecord): ShoppingListItem {
  return {
    id: article.id,
    ingredient: article.ingredient,
    label: article.label,
    quantity: article.quantity?.toNumber() ?? null,
    unit: article.unit,
    origin: article.origin,
    checked: article.checked,
    position: article.position,
  };
}

function exposer(liste: ShoppingListRecord): ShoppingList {
  return {
    id: liste.id,
    mealPlan: liste.mealPlan && {
      id: liste.mealPlan.id,
      week: liste.mealPlan.week.toISOString().slice(0, 10),
    },
    status: liste.status,
    producedAt: liste.producedAt.toISOString(),
    closedAt: liste.closedAt?.toISOString() ?? null,
    items: liste.items.map(exposerLArticle),
  };
}
