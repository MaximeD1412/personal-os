import { Injectable } from '@nestjs/common';
import {
  designation,
  portions,
  type ApiFieldError,
  type ShoppingGap,
  type ShoppingList,
  type ShoppingListClosure,
  type ShoppingListItem,
  type ShoppingListItemInput,
  type ShoppingListProductionQuery,
  type ShoppingListQuery,
} from '@personal-os/contracts';
import type Decimal from 'decimal.js';
import { ErreurMetier, Introuvable } from '../erreurs/erreur-metier';
import type { EchecDeConversion } from './conversion/convertir';
import {
  consolider,
  enConditionnements,
  type EchecDeConsolidation,
} from './courses/consolider';
import { ecart } from './courses/ecart';
import { acheter, type EchecDAchat } from './stock/acheter';
import {
  codePrisma,
  ShoppingListRepository,
  type IngredientAConsoliderRecord,
  type ListesLues,
  type PlanningAConsoliderRecord,
  type ShoppingListItemRecord,
  type ShoppingListRecord,
} from './shopping-list.repository';

/** Combien de fois un complément recalcule son écart quand un autre est passé avant lui. */
const ESSAIS_DE_COMPLEMENT = 5;

/**
 * Combien de fois les besoins se relisent quand une clôture ou un repas
 * cuisiné a bougé le stock pendant leur lecture.
 */
const ESSAIS_DE_LECTURE = 5;

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
 * arrêté, un complément sans rien qui manque, un Ingrédient qui ne se
 * convertit pas, un Ingrédient inconnu, une liste close, un article du
 * planning qu'on voudrait retirer, un achat périssable sans péremption.
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
      const { besoins, listesLues } = await this.lireLesBesoins(
        planId,
        complement ? 'complement' : 'production',
      );
      if (complement && besoins.length === 0) {
        throw new ErreurMetier(
          'food.no_shopping_gap',
          "Rien ne manque aux listes déjà produites pour ce planning : il n'y a pas de liste de complément à produire.",
        );
      }

      // Le conditionnement se fige avec la liste (ADR 0012) : un Produit
      // modifié ou retiré ensuite ne la change pas.
      const articles = besoins.map(
        ({ ingredient, quantite, conditionnements }) => ({
          ingredientId: ingredient.id,
          label: null,
          quantity: quantite.toFixed(3),
          unit: ingredient.canonicalUnit,
          ...(ingredient.preferredProduct && conditionnements !== null
            ? {
                productId: ingredient.preferredProduct.id,
                packages: conditionnements,
                packageQuantity:
                  ingredient.preferredProduct.packageQuantity.toString(),
                packageLabel: ingredient.preferredProduct.packageLabel,
              }
            : {}),
        }),
      );

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
        // Sinon, un autre complément ou une clôture est passé avant : l'écart
        // se recalcule.
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
    const { besoins } = await this.lireLesBesoins(planId, 'ecart');
    return {
      missing: besoins.map(({ ingredient, quantite }) => ({
        ingredient: { id: ingredient.id, displayName: ingredient.displayName },
        quantity: quantite.toNumber(),
        unit: ingredient.canonicalUnit,
      })),
    };
  }

  /**
   * Les besoins d'une production, d'un complément ou d'un écart, lus de façon
   * cohérente avec le stock.
   *
   * Le stock se lit après le planning et ses listes. Une clôture (qui monte
   * un achat au stock) ou un repas cuisiné (qui en consomme) commité entre
   * ces lectures compterait deux fois le même mouvement : une fois au stock,
   * une fois sur la liste ou le repas lus avant lui. Ces gestes écrivent le
   * stock et leur trace dans la même transaction : relus après le stock, ils
   * disent si l'on a lu au milieu de l'un d'eux, et l'on relit tout.
   */
  private async lireLesBesoins(
    planId: string,
    lecture: 'production' | 'complement' | 'ecart',
  ): Promise<{ besoins: Besoin[]; listesLues?: ListesLues }> {
    for (let essai = 1; ; essai++) {
      const planning =
        lecture === 'ecart'
          ? await this.planning(planId)
          : await this.planningArrete(planId);
      const listes =
        lecture === 'production'
          ? []
          : await this.repository.listesDuPlanning(planId);
      const lu =
        lecture === 'production'
          ? { besoins: await this.besoinActuel(planning) }
          : await this.manquants(planning, listes);

      const etat = await this.repository.etatDuPlanning(planId);
      const coherent =
        listes.every(
          ({ id, status }) => status !== 'OPEN' || etat.listesOuvertes.has(id),
        ) &&
        planning.entries.every(
          ({ id, cookedMeal }) =>
            cookedMeal !== null || !etat.repasCuisines.has(id),
        );
      if (coherent) return lu;
      if (essai === ESSAIS_DE_LECTURE) {
        throw new ErreurMetier(
          'food.pantry_busy',
          'Le stock change en ce moment : réessayez.',
        );
      }
    }
  }

  /**
   * Les besoins du planning qu'aucune liste déjà produite pour lui ne couvre,
   * et ces listes. Sans liste, il n'y a pas d'écart : le planning attend sa
   * première liste.
   *
   * Seule une liste ouverte couvre encore un besoin. Une liste close a monté
   * son achat au stock, que le besoin actuel déduit déjà ; ce qu'elle n'a pas
   * acheté redevient un manque.
   */
  private async manquants(
    planning: PlanningAConsoliderRecord,
    listes: Awaited<ReturnType<ShoppingListRepository['listesDuPlanning']>>,
  ): Promise<{ besoins: Besoin[]; listesLues: ListesLues }> {
    const ouvertes = listes.filter(({ status }) => status === 'OPEN');
    const listesLues = {
      toutes: listes.map(({ id }) => id),
      ouvertes: ouvertes.map(({ id }) => id),
    };
    if (listes.length === 0) return { besoins: [], listesLues };

    const besoins = await this.besoinActuel(planning);
    const { manquants } = ecart(
      besoins.map(({ ingredient, quantite }) => ({
        ingredientId: ingredient.id,
        quantite,
        unite: ingredient.canonicalUnit,
      })),
      ouvertes.map(({ items }) => ({
        articles: items.map(
          ({
            ingredientId,
            quantity,
            unit,
            origin,
            packages,
            packageQuantity,
          }) => ({
            ingredientId,
            quantite: quantity?.toString() ?? null,
            unite: unit,
            origin,
            conditionnements: packages,
            contenance: packageQuantity?.toString() ?? null,
          }),
        ),
      })),
    );
    const ingredientDe = new Map(
      besoins.map(({ ingredient }) => [ingredient.id, ingredient]),
    );
    return {
      besoins: manquants.map(({ ingredientId, quantite }) => {
        const ingredient = ingredientDe.get(
          ingredientId,
        ) as IngredientAConsoliderRecord;
        // Un complément compte ses conditionnements sur ce qui manque.
        const produit = ingredient.preferredProduct;
        return {
          ingredient,
          quantite,
          conditionnements: produit
            ? enConditionnements(quantite, produit.packageQuantity.toString())
            : null,
        };
      }),
      listesLues,
    };
  }

  /**
   * La consolidation actuelle du planning, dans l'ordre alphabétique où une
   * liste se lit au magasin. Une conversion impossible la refuse entière. Un
   * repas déjà cuisiné n'a plus besoin de rien : ce qu'il a pris au stock en
   * est déjà sorti.
   */
  private async besoinActuel(lu: PlanningAConsoliderRecord): Promise<Besoin[]> {
    const planning = {
      ...lu,
      entries: lu.entries.filter(({ cookedMeal }) => cookedMeal === null),
    };
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
      [...ingredients.values()].map(
        ({ id, canonicalUnit, gramsPerPiece, preferredProduct }) => ({
          id,
          canonicalUnit,
          gramsPerPiece: gramsPerPiece?.toString() ?? null,
          produitPrefere: preferredProduct && {
            id: preferredProduct.id,
            contenance: preferredProduct.packageQuantity.toString(),
          },
        }),
      ),
    );

    if ('echecs' in consolidation) {
      throw conversionImpossible(consolidation.echecs, ingredients);
    }

    return consolidation.articles
      .map(({ ingredientId, quantite, conditionnement }) => ({
        ingredient: ingredients.get(
          ingredientId,
        ) as IngredientAConsoliderRecord,
        quantite,
        conditionnements: conditionnement?.nombre ?? null,
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
      liste.items.map(
        ({
          id,
          ingredient,
          quantity,
          unit,
          packages,
          packageQuantity,
          checked,
        }) => ({
          id,
          ingredient,
          quantite: quantity?.toString() ?? null,
          unite: unit,
          conditionnement:
            packages !== null && packageQuantity !== null
              ? { nombre: packages, contenance: packageQuantity.toString() }
              : null,
          coche: checked,
        }),
      ),
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

/**
 * Un besoin à acheter, en Unité canonique de son Ingrédient, et le nombre de
 * conditionnements de son Produit préféré qui le couvrent, s'il en a un.
 */
interface Besoin {
  ingredient: IngredientAConsoliderRecord;
  quantite: Decimal;
  conditionnements: number | null;
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
    productId: article.productId,
    packages: article.packages,
    packageQuantity: article.packageQuantity?.toNumber() ?? null,
    packageLabel: article.packageLabel,
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
