import { Injectable } from '@nestjs/common';
import {
  designation,
  portions,
  type ApiFieldError,
  type ShoppingList,
  type ShoppingListClosure,
  type ShoppingListItem,
  type ShoppingListItemInput,
  type ShoppingListQuery,
} from '@personal-os/contracts';
import { ErreurMetier, Introuvable } from '../erreurs/erreur-metier';
import type { EchecDeConversion } from './conversion/convertir';
import { consolider, type EchecDeConsolidation } from './courses/consolider';
import { acheter, type EchecDAchat } from './stock/acheter';
import {
  codePrisma,
  ShoppingListRepository,
  type IngredientAConsoliderRecord,
  type PlanningAConsoliderRecord,
  type ShoppingListItemRecord,
  type ShoppingListRecord,
} from './shopping-list.repository';

/**
 * Une écriture concurrente de la liste ou du stock fait recommencer la
 * clôture sur l'état relu ; au-delà de ces essais, on renonce plutôt que
 * d'insister.
 */
const ESSAIS_DE_CLOTURE = 5;

/**
 * Les Listes de courses du Foyer, figées à leur production (ADR 0012) : rien
 * ne les recalcule. Les saisies arrivent validées par leur schéma (ADR 0030) ;
 * il reste ici ce qu'un schéma ne juge pas seul. Un planning qui n'est pas
 * arrêté, un Ingrédient qui ne se convertit pas, un Ingrédient inconnu, une
 * liste close, un article du planning qu'on voudrait retirer, un achat
 * périssable sans péremption.
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
   * nouveau depuis le même planning crée une autre liste.
   */
  async produire(planId: string): Promise<ShoppingList> {
    const planning = await this.planningArrete(planId);
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

    // Au magasin, une liste se lit dans l'ordre alphabétique.
    const articles = consolidation.articles
      .map(({ ingredientId, quantite }) => ({
        ingredient: ingredients.get(
          ingredientId,
        ) as IngredientAConsoliderRecord,
        quantite,
      }))
      .sort((a, b) => a.ingredient.name.localeCompare(b.ingredient.name, 'fr'))
      .map(({ ingredient, quantite }) => ({
        ingredientId: ingredient.id,
        label: null,
        quantity: quantite.toFixed(3),
        unit: ingredient.canonicalUnit,
      }));

    try {
      return exposer(await this.repository.produire(planId, articles));
    } catch (erreur) {
      if (codePrisma(erreur) !== 'P2025') {
        throw erreur;
      }
      // Le planning a été rouvert depuis qu'on l'a lu.
      await this.planningArrete(planId);
      throw erreur;
    }
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

  /**
   * Clôt une liste ouverte : chaque article coché d'un Ingrédient monte le
   * Stock domestique de sa quantité réellement achetée (ADR 0013), puis la
   * liste ne se modifie plus. Tout ou rien, dans une transaction.
   */
  async cloturer(
    id: string,
    { items }: ShoppingListClosure,
  ): Promise<ShoppingList> {
    for (let essai = 1; ; essai++) {
      try {
        return await this.essayerDeCloturer(id, items);
      } catch (erreur) {
        const code = codePrisma(erreur);
        if (code !== 'P2025' && code !== 'P2002') throw erreur;
        if (essai === ESSAIS_DE_CLOTURE) {
          throw new ErreurMetier(
            'food.pantry_busy',
            'La liste ou le stock change en ce moment : clôturez la liste à nouveau.',
          );
        }
      }
    }
  }

  private async essayerDeCloturer(
    id: string,
    precisions: ShoppingListClosure['items'],
  ): Promise<ShoppingList> {
    const liste = await this.liste(id);
    if (liste.status !== 'OPEN') {
      throw new ErreurMetier(
        'food.list_closed',
        'Cette Liste de courses est déjà close : son achat est au stock.',
      );
    }
    for (const { itemId } of precisions) {
      this.article(liste, itemId);
    }

    const ingredientIds = [
      ...new Set(
        liste.items.flatMap(({ checked, ingredient }) =>
          checked && ingredient ? [ingredient.id] : [],
        ),
      ),
    ];
    const achat = acheter(
      liste.items.map(({ id, ingredient, quantity, unit, checked }) => ({
        id,
        ingredient,
        quantite: quantity?.toString() ?? null,
        unite: unit,
        coche: checked,
      })),
      new Map(
        precisions.map(({ itemId, purchasedQuantity, expiresOn }) => [
          itemId,
          {
            ...(purchasedQuantity === undefined
              ? {}
              : { quantiteAchetee: String(purchasedQuantity) }),
            ...(expiresOn === undefined ? {} : { expireLe: expiresOn }),
          },
        ]),
      ),
      await this.repository.lignesDeStock(ingredientIds),
    );
    if ('echecs' in achat) {
      throw achatIncomplet(achat.echecs, liste);
    }

    return exposer(
      await this.repository.cloturer(
        id,
        liste.items.map(({ id, checked }) => ({ id, checked })),
        achat.recalages.map(({ ingredientId, avant, apres }) => ({
          ingredientId,
          avant: avant && {
            quantity: avant.quantite.toString(),
            expiresOn: avant.expireLe,
          },
          apres: {
            quantity: apres.quantite.toString(),
            expiresOn: apres.expireLe,
          },
        })),
      ),
    );
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

  private async planningArrete(id: string): Promise<PlanningAConsoliderRecord> {
    const planning = await this.repository.planningAConsolider(id);
    if (!planning) {
      throw new Introuvable(
        'food.plan_not_found',
        'Aucun Planning de repas de cet identifiant.',
      );
    }
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

const ECHECS_D_ACHAT: Readonly<
  Record<
    EchecDAchat,
    { code: string; message: (n: number) => string; champ: string }
  >
> = {
  peremption_manquante: {
    code: 'food.expiry_required',
    message: (n) =>
      `La liste n'est pas close : ${n === 1 ? 'un article périssable n’a pas' : `${n} articles périssables n’ont pas`} de date de péremption.`,
    champ: 'est périssable : donnez sa date de péremption',
  },
  quantite_manquante: {
    code: 'food.purchased_quantity_required',
    message: (n) =>
      `La liste n'est pas close : ${n === 1 ? 'un article n’a pas' : `${n} articles n’ont pas`} de quantité achetée.`,
    champ:
      'n’a pas de quantité en Unité canonique : donnez la quantité achetée',
  },
};

/** Aucun stock ne monte : l'échec nomme chaque article en cause, dans `fields`. */
function achatIncomplet(
  echecs: readonly { articleId: string; raison: EchecDAchat }[],
  liste: ShoppingListRecord,
): ErreurMetier {
  const { code, message, champ } = ECHECS_D_ACHAT[echecs[0].raison];
  return new ErreurMetier(
    code,
    message(echecs.length),
    422,
    echecs.map(({ articleId, raison }) => {
      const article = liste.items.find(({ id }) => id === articleId);
      return {
        path: articleId,
        code:
          raison === 'peremption_manquante'
            ? 'expiry_required'
            : 'purchased_quantity_required',
        message: `« ${article ? designation(article) : articleId} » ${champ}.`,
      };
    }),
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
    ingredient: article.ingredient && {
      id: article.ingredient.id,
      displayName: article.ingredient.displayName,
      canonicalUnit: article.ingredient.canonicalUnit,
      perishable: article.ingredient.perishable,
    },
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
