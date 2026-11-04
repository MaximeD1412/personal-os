import type {
  CanonicalUnit,
  ShoppingListItemOrigin,
} from '@personal-os/contracts';
import Decimal from 'decimal.js';

/** Un besoin de la consolidation actuelle, en Unité canonique. */
export interface BesoinActuel {
  ingredientId: string;
  quantite: Decimal.Value;
  unite: CanonicalUnit;
}

/** Un Article d'une liste déjà produite, tel qu'il est figé. */
export interface ArticleDeListe {
  ingredientId: string | null;
  quantite: Decimal.Value | null;
  unite: CanonicalUnit | null;
  origin: ShoppingListItemOrigin;
}

export interface ListeDuPlanning {
  articles: readonly ArticleDeListe[];
}

export interface Manquant {
  ingredientId: string;
  quantite: Decimal;
}

/**
 * L'écart entre un Planning de repas et les listes déjà produites pour lui :
 * ce que la consolidation actuelle exige au-delà de ce que ces listes
 * couvrent, par Ingrédient. Les listes restent figées (ADR 0012) : l'écart
 * ne les touche pas, il nourrit une liste de complément.
 *
 * Un excédent (un repas retiré après la liste) n'est jamais signalé : les
 * courses faites restent faites.
 *
 * Seules les listes encore ouvertes sont à passer : l'achat d'une liste close
 * est au stock, que `besoinActuel` a déjà déduit.
 */
export function ecart(
  besoinActuel: readonly BesoinActuel[],
  listesDuPlanning: readonly ListeDuPlanning[],
): { manquants: Manquant[] } {
  // Seul ce que le planning a mis sur une liste la couvre : un ajout manuel
  // répond à un autre besoin. Un article figé dans une unité qui n'est plus
  // l'Unité canonique de son Ingrédient ne se compare pas.
  const couvert = new Map<string, Decimal>();
  for (const { articles } of listesDuPlanning) {
    for (const { ingredientId, quantite, unite, origin } of articles) {
      if (origin !== 'PLAN' || ingredientId === null || quantite === null) {
        continue;
      }
      const cle = `${ingredientId}:${unite}`;
      couvert.set(cle, (couvert.get(cle) ?? new Decimal(0)).plus(quantite));
    }
  }

  const manquants: Manquant[] = [];
  for (const { ingredientId, quantite, unite } of besoinActuel) {
    const reste = new Decimal(quantite).minus(
      couvert.get(`${ingredientId}:${unite}`) ?? 0,
    );
    if (reste.greaterThan(0)) manquants.push({ ingredientId, quantite: reste });
  }
  return { manquants };
}
