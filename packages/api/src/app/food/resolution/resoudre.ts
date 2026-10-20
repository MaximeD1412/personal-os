import { normaliserLibelle } from '@personal-os/contracts';

/** Ce que la résolution lit du catalogue : des noms et des Alias, normalisés. */
export interface Catalogue {
  ingredients: readonly { id: string; name: string }[];
  alias: readonly { label: string; ingredientId: string }[];
}

export type Resolution =
  | { ingredientId: string }
  | { inconnu: true; suggestions: string[] };

const SUGGESTIONS_AU_PLUS = 5;

/**
 * Les mots qui ne désignent rien à eux seuls : « pâte de coing » ne doit pas
 * suggérer « farine de blé ».
 */
const MOTS_GRAMMATICAUX = new Set([
  'a',
  'au',
  'aux',
  'avec',
  'd',
  'de',
  'des',
  'du',
  'en',
  'et',
  'l',
  'la',
  'le',
  'les',
  'ou',
  'pour',
  'un',
  'une',
]);

/**
 * Rattache un libellé libre à un Ingrédient, après normalisation : par un
 * Alias d'abord, puis par le nom exact. Rien d'approché ne résout : un
 * libellé qu'on ne reconnaît pas est inconnu, avec au plus cinq suggestions,
 * les Ingrédients dont le nom contient le plus de mots du libellé d'abord.
 * C'est l'Alias, posé par l'utilisateur, qui fera qu'on ne redemande plus.
 */
export function resoudre(libelle: string, catalogue: Catalogue): Resolution {
  const normalise = normaliserLibelle(libelle);

  const alias = catalogue.alias.find(({ label }) => label === normalise);
  if (alias) return { ingredientId: alias.ingredientId };

  const ingredient = catalogue.ingredients.find(
    ({ name }) => name === normalise,
  );
  if (ingredient) return { ingredientId: ingredient.id };

  return { inconnu: true, suggestions: suggerer(normalise, catalogue) };
}

function suggerer(normalise: string, { ingredients }: Catalogue): string[] {
  const mots = enMots(normalise).filter((mot) => !MOTS_GRAMMATICAUX.has(mot));

  return ingredients
    .map((ingredient) => ({
      ingredient,
      communs: mots.filter((mot) => contient(ingredient.name, mot)).length,
    }))
    .filter(({ communs }) => communs > 0)
    .sort(
      (a, b) =>
        b.communs - a.communs ||
        a.ingredient.name.localeCompare(b.ingredient.name),
    )
    .slice(0, SUGGESTIONS_AU_PLUS)
    .map(({ ingredient }) => ingredient.id);
}

/**
 * Le nom contient le mot, ou le mot est le pluriel en « s » ou « x » d'un des
 * mots du nom (« oignons » pour « oignon jaune », « choux » pour « chou »).
 */
function contient(nom: string, mot: string): boolean {
  if (nom.includes(mot)) return true;

  const singulier = /[sx]$/.test(mot) ? mot.slice(0, -1) : null;
  return singulier !== null && enMots(nom).includes(singulier);
}

/** Les mots d'un libellé normalisé, coupés aussi aux apostrophes et tirets. */
function enMots(normalise: string): string[] {
  return normalise.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}
