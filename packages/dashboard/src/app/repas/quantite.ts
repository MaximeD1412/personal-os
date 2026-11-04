import type {
  CanonicalUnit,
  RecipeLine,
  RecipeUnit,
} from '@personal-os/contracts';

/** L'abréviation d'une Unité de recette, telle qu'une fiche la lit. */
const ABREVIATIONS: Readonly<Record<Exclude<RecipeUnit, 'PIECE'>, string>> = {
  G: 'g',
  KG: 'kg',
  MG: 'mg',
  ML: 'ml',
  CL: 'cl',
  L: 'l',
  TSP: 'c. à café',
  TBSP: 'c. à soupe',
};

const NOMBRE = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });

/**
 * La quantité d'une ligne dans l'unité où on l'a saisie : « 250 g »,
 * « 1,5 c. à café », « 2 pièces ». Aucune conversion ici : elle n'a lieu qu'à
 * la consolidation des courses.
 */
export function quantiteDeLigne({
  quantity,
  unit,
}: Pick<RecipeLine, 'quantity' | 'unit'>): string {
  const nombre = NOMBRE.format(quantity);
  if (unit === 'PIECE') {
    return `${nombre}\u00a0${quantity >= 2 ? 'pièces' : 'pièce'}`;
  }
  return `${nombre}\u00a0${ABREVIATIONS[unit]}`;
}

/** L'unité d'une ligne seule, telle qu'elle suit un champ de quantité. */
export function uniteDeLigne(unit: RecipeUnit): string {
  return unit === 'PIECE' ? 'pièce(s)' : ABREVIATIONS[unit];
}

/** « 1 portion », « 4 portions ». */
export function portions(servings: number): string {
  return `${servings}\u00a0${servings >= 2 ? 'portions' : 'portion'}`;
}

/** L'Unité canonique telle qu'elle suit une quantité du stock. */
export const UNITES_CANONIQUES: Readonly<Record<CanonicalUnit, string>> = {
  GRAM: 'g',
  MILLILITER: 'ml',
  PIECE: 'pièce(s)',
};

/** Une quantité en Unité canonique : « 1 000 ml », « 4 pièce(s) ». */
export function quantiteCanonique(
  quantity: number,
  unit: CanonicalUnit,
): string {
  return `${NOMBRE.format(quantity)}\u00a0${UNITES_CANONIQUES[unit]}`;
}

/**
 * Un nombre de conditionnements d'un Produit : « 1 boîte », « 2 boîtes »,
 * « 2 bocaux », « 2 pots de yaourt ». Le nom se saisit au singulier ; seul
 * son premier mot s'accorde, selon la règle courante du pluriel.
 */
export function conditionnements(nombre: number, libelle: string): string {
  if (nombre < 2) return `${NOMBRE.format(nombre)} ${libelle}`;
  const [premier, ...reste] = libelle.split(' ');
  return `${NOMBRE.format(nombre)} ${[pluriel(premier), ...reste].join(' ')}`;
}

function pluriel(mot: string): string {
  if (/[sxz]$/i.test(mot)) return mot;
  if (/al$/i.test(mot)) return `${mot.slice(0, -2)}aux`;
  if (/(au|eu)$/i.test(mot)) return `${mot}x`;
  return `${mot}s`;
}
