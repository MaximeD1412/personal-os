import Decimal from 'decimal.js';
import type { CanonicalUnit } from '@personal-os/contracts';
import { recaler, type LigneDeStock, type LigneRecalee } from './recaler';

/** Un Article de la liste qu'on clôt, tel que l'achat le lit. */
export interface ArticleAchete {
  id: string;
  /** L'Ingrédient tel qu'il est aujourd'hui ; vide pour un simple libellé. */
  ingredient: {
    id: string;
    canonicalUnit: CanonicalUnit;
    perishable: boolean;
  } | null;
  /** La quantité de la liste, dans l'unité qu'elle avait à l'ajout. */
  quantite: Decimal.Value | null;
  unite: CanonicalUnit | null;
  /**
   * Les conditionnements figés sur la liste, et ce que chacun contient, dans
   * l'unité de la liste ; aucun pour un article sans Produit.
   */
  conditionnement?: { nombre: number; contenance: Decimal.Value } | null;
  coche: boolean;
}

/** Ce que le magasin a précisé d'un article : sa quantité achetée, sa péremption. */
export interface PrecisionDAchat {
  /** En Unité canonique. */
  quantiteAchetee?: Decimal.Value;
  /** Un jour civil, `YYYY-MM-DD`. */
  expireLe?: string;
}

/** La ligne de stock d'un Ingrédient avant l'achat (aucune s'il n'y était pas), et après. */
export interface RecalageDAchat {
  ingredientId: string;
  avant: LigneRecalee | null;
  apres: LigneRecalee;
}

export type EchecDAchat = 'peremption_manquante' | 'quantite_manquante';

export type Achat =
  | { recalages: RecalageDAchat[] }
  | { echecs: { articleId: string; raison: EchecDAchat }[] };

/**
 * Ce que la clôture d'une liste fait au Stock domestique (ADR 0013) : chaque
 * article coché d'un Ingrédient y entre, de sa quantité achetée, ou à défaut
 * de ce que la liste dit d'acheter : ses conditionnements entiers quand elle
 * en porte (deux boîtes de 400 g font 800 g, même pour un besoin de 700 g),
 * sa quantité sinon. Un article non coché n'est pas acheté ; un simple
 * libellé n'a pas de stock. Deux articles du même Ingrédient montent sa seule
 * ligne l'un après l'autre, et le recaleur garde la péremption la plus proche.
 *
 * Deux cas font échouer tout l'achat, article par article, pour qu'aucun
 * stock ne monte d'une quantité devinée : un Ingrédient périssable sans
 * péremption, et un article dont la quantité de liste ne dit rien en Unité
 * canonique (il n'en a pas, ou l'Ingrédient a changé d'unité depuis l'ajout)
 * sans quantité achetée. Les échecs de péremption passent devant : ils
 * suffisent à refuser.
 */
export function acheter(
  articles: readonly ArticleAchete[],
  precisions: ReadonlyMap<string, PrecisionDAchat>,
  stock: ReadonlyMap<string, LigneDeStock>,
): Achat {
  const peremptions: string[] = [];
  const quantites: string[] = [];
  const lignes = new Map<
    string,
    { avant: LigneRecalee | null; apres: LigneRecalee }
  >();

  for (const {
    id,
    ingredient,
    quantite,
    unite,
    conditionnement,
    coche,
  } of articles) {
    if (!coche || !ingredient) continue;
    const precision = precisions.get(id) ?? {};
    const achetee =
      precision.quantiteAchetee ??
      (unite !== ingredient.canonicalUnit
        ? null
        : conditionnement
          ? new Decimal(conditionnement.contenance).times(
              conditionnement.nombre,
            )
          : quantite);
    if (ingredient.perishable && precision.expireLe === undefined) {
      peremptions.push(id);
    }
    if (achetee === null) {
      quantites.push(id);
    }
    if (peremptions.length > 0 || quantites.length > 0 || achetee === null) {
      continue;
    }

    const lue = stock.get(ingredient.id) ?? null;
    const avant = lignes.has(ingredient.id)
      ? (lignes.get(ingredient.id)?.avant ?? null)
      : lue && { quantite: new Decimal(lue.quantite), expireLe: lue.expireLe };
    const { ligne: apres } = recaler(lignes.get(ingredient.id)?.apres ?? lue, {
      type: 'ACHAT',
      quantite: achetee,
      expireLe: precision.expireLe ?? null,
    });
    lignes.set(ingredient.id, { avant, apres });
  }

  if (peremptions.length > 0) {
    return {
      echecs: peremptions.map((articleId) => ({
        articleId,
        raison: 'peremption_manquante',
      })),
    };
  }
  if (quantites.length > 0) {
    return {
      echecs: quantites.map((articleId) => ({
        articleId,
        raison: 'quantite_manquante',
      })),
    };
  }
  return {
    recalages: [...lignes].map(([ingredientId, { avant, apres }]) => ({
      ingredientId,
      avant,
      apres,
    })),
  };
}
