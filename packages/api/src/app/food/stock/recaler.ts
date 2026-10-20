import Decimal from 'decimal.js';

/**
 * Une ligne du Stock domestique : la quantité d'un Ingrédient, en Unité
 * canonique, et sa péremption la plus proche (un `zDay`), vide si on ne la
 * connaît pas.
 */
export interface LigneDeStock {
  quantite: Decimal.Value;
  expireLe: string | null;
}

/** Une ligne telle que le recaleur la rend : sa quantité en décimal exact. */
export interface LigneRecalee {
  quantite: Decimal;
  expireLe: string | null;
}

/**
 * Les trois voies de recalage (ADR 0013). `ACHAT` ajoute (la clôture d'une
 * liste, CUISINE-10), `CONSOMMATION` retire (un Repas cuisiné, CUISINE-11),
 * `CORRECTION` remplace (l'édition manuelle). Une quantité est positive ou
 * nulle, en Unité canonique.
 */
export type Mouvement =
  | { type: 'ACHAT'; quantite: Decimal.Value; expireLe?: string | null }
  | { type: 'CONSOMMATION'; quantite: Decimal.Value }
  | { type: 'CORRECTION'; quantite: Decimal.Value; expireLe?: string | null };

export interface Recalage {
  ligne: LigneRecalee;
  /** La part d'une consommation que le stock ne couvrait pas. */
  manque?: Decimal;
}

/**
 * Applique un mouvement à la ligne d'un Ingrédient, ou à son absence. Il n'y a
 * qu'une ligne par Ingrédient, sans lots : un rachat garde la péremption la
 * plus proche des deux. Une consommation ne descend jamais sous zéro ; ce
 * qu'elle demandait de plus revient en `manque`. Une ligne à zéro perd sa
 * péremption : il ne reste rien qui puisse périmer.
 */
export function recaler(
  ligne: LigneDeStock | null,
  mouvement: Mouvement,
): Recalage {
  const quantite = new Decimal(mouvement.quantite);
  if (quantite.isNegative() || !quantite.isFinite()) {
    throw new RangeError(
      `Un mouvement de stock porte une quantité positive ou nulle, pas ${mouvement.quantite}.`,
    );
  }
  const actuelle = new Decimal(ligne?.quantite ?? 0);
  const peremption = ligne?.expireLe ?? null;

  switch (mouvement.type) {
    case 'ACHAT':
      return {
        ligne: aZeroSansPeremption(
          actuelle.plus(quantite),
          laPlusProche(peremption, mouvement.expireLe ?? null),
        ),
      };
    case 'CONSOMMATION': {
      const restante = Decimal.max(actuelle.minus(quantite), 0);
      const manque = quantite.minus(actuelle);
      return {
        ligne: aZeroSansPeremption(restante, peremption),
        ...(manque.greaterThan(0) ? { manque } : {}),
      };
    }
    case 'CORRECTION':
      return {
        ligne: aZeroSansPeremption(quantite, mouvement.expireLe ?? null),
      };
  }
}

/** Deux jours civils `YYYY-MM-DD` se comparent comme des textes. */
function laPlusProche(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return a < b ? a : b;
}

function aZeroSansPeremption(
  quantite: Decimal,
  expireLe: string | null,
): LigneRecalee {
  return { quantite, expireLe: quantite.isZero() ? null : expireLe };
}
