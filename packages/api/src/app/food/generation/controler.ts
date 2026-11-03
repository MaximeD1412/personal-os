/*
 * Le contrôle déterministe d'un Tour de génération, hors du modèle (risque
 * IA-1) : la garantie contre un allergène n'est jamais le prompt. Chaque
 * proposition est confrontée, ingrédient par ingrédient, aux interdits des
 * Participants de son créneau, et seulement d'eux. Ce qui ne passe pas n'est
 * jamais présenté comme un repas proposé : le créneau reste vide, et la raison
 * est rendue.
 */
import type {
  Allergen,
  RecipeUnit,
  RejectedSlot,
  RejectionReason,
} from '@personal-os/contracts';
import {
  contraintesDuRepas,
  type PreferenceAAppliquer,
} from '../preferences/appliquer';
import { resoudre, type Catalogue } from '../resolution/resoudre';
import type { PropositionDeRepas, RecetteProposee } from './proposition';
import type { Creneau } from './tours';

/** Le catalogue tel que le contrôle le lit : chaque Ingrédient avec ses Allergènes. */
export interface CatalogueDuControle extends Catalogue {
  ingredients: readonly {
    id: string;
    name: string;
    allergens: readonly Allergen[];
  }[];
}

/** Une Recette du Foyer, par ses lignes. */
export interface RecetteDuControle {
  id: string;
  lines: readonly { ingredientId: string; label: string }[];
}

export interface ContexteDuControle {
  catalogue: CatalogueDuControle;
  recettes: readonly RecetteDuControle[];
  /** Les Préférences alimentaires du Foyer : le contrôle retient celles des Participants. */
  preferences: readonly PreferenceAAppliquer[];
}

/** Une recette nouvelle retenue, ses ingrédients résolus. */
export interface RecetteNouvelle {
  title: string;
  servings: number;
  steps: string[];
  lignes: { ingredientId: string; quantity: number; unit: RecipeUnit }[];
}

/** Une proposition qui a passé le contrôle, pour son créneau. */
export interface Retenue {
  creneau: Creneau;
  recette: { recipeId: string } | { nouvelle: RecetteNouvelle };
}

export interface Controle {
  retenues: Retenue[];
  rejetes: RejectedSlot[];
}

/** Un ingrédient de la proposition, tel que le contrôle le confronte. */
interface IngredientAControler {
  label: string;
  ingredientId: string | null;
}

type Verdict =
  | { retenue: Retenue['recette'] }
  | Omit<RejectedSlot, 'slot'>;

/**
 * Chaque créneau du tour reçoit la première proposition qui le vise, ou rien.
 * Une proposition pour un créneau qui n'était pas demandé est ignorée.
 */
export function controler(
  propositions: readonly PropositionDeRepas[],
  creneaux: readonly Creneau[],
  contexte: ContexteDuControle,
): Controle {
  const controle: Controle = { retenues: [], rejetes: [] };

  for (const creneau of creneaux) {
    const proposition = propositions.find(
      ({ day, moment }) => day === creneau.day && moment === creneau.moment,
    );
    const verdict = juger(proposition, creneau, contexte);

    if ('retenue' in verdict) {
      controle.retenues.push({ creneau, recette: verdict.retenue });
    } else {
      controle.rejetes.push({ slot: enCreneau(creneau), ...verdict });
    }
  }

  return controle;
}

function juger(
  proposition: PropositionDeRepas | undefined,
  creneau: Creneau,
  contexte: ContexteDuControle,
): Verdict {
  if (proposition?.recipeId != null) {
    const recette = contexte.recettes.find(
      ({ id }) => id === proposition.recipeId,
    );
    if (!recette) {
      return rejet('UNKNOWN_RECIPE');
    }
    return (
      confronter(recette.lines, creneau, contexte) ?? {
        retenue: { recipeId: recette.id },
      }
    );
  }

  if (proposition?.recipe) {
    const { recipe } = proposition;
    const ingredients = recipe.ingredients.map(({ label }) => ({
      label,
      ...resolu(resoudre(label, contexte.catalogue)),
    }));
    return (
      confronter(ingredients, creneau, contexte) ?? {
        retenue: { nouvelle: enRecetteNouvelle(recipe, ingredients) },
      }
    );
  }

  return rejet('NO_PROPOSAL');
}

/**
 * Le rejet d'une proposition, ou rien si elle passe. Un interdit l'emporte
 * sur un libellé inconnu : la raison la plus grave est celle qu'on rend.
 */
function confronter(
  ingredients: readonly IngredientAControler[],
  creneau: Creneau,
  { catalogue, preferences }: ContexteDuControle,
): Omit<RejectedSlot, 'slot'> | null {
  const { interdits } = contraintesDuRepas(preferences, creneau.participantIds);
  const concernes = (vise: (preference: PreferenceAAppliquer) => boolean) =>
    preferences
      .filter(
        (preference) =>
          preference.kind !== 'DISLIKED' &&
          creneau.participantIds.includes(preference.userId) &&
          vise(preference),
      )
      .map(({ userId }) => userId)
      .filter((userId, rang, tous) => tous.indexOf(userId) === rang);

  for (const ingredient of ingredients) {
    const { ingredientId } = ingredient;
    if (ingredientId === null) continue;

    if (interdits.ingredients.includes(ingredientId)) {
      return {
        reason: 'EXCLUDED_INGREDIENT',
        ingredient,
        allergen: null,
        participantIds: concernes((p) => p.ingredientId === ingredientId),
      };
    }

    const allergenes =
      catalogue.ingredients.find(({ id }) => id === ingredientId)?.allergens ??
      [];
    const allergen = allergenes.find((a) => interdits.allergenes.includes(a));
    if (allergen) {
      return {
        reason: 'ALLERGEN',
        ingredient,
        allergen,
        participantIds: concernes((p) => p.allergen === allergen),
      };
    }
  }

  const inconnu = ingredients.find(({ ingredientId }) => ingredientId === null);
  return inconnu
    ? {
        reason: 'UNKNOWN_INGREDIENT',
        ingredient: inconnu,
        allergen: null,
        participantIds: [],
      }
    : null;
}

function rejet(reason: RejectionReason): Omit<RejectedSlot, 'slot'> {
  return { reason, ingredient: null, allergen: null, participantIds: [] };
}

function resolu(resolution: ReturnType<typeof resoudre>): {
  ingredientId: string | null;
} {
  return { ingredientId: 'ingredientId' in resolution ? resolution.ingredientId : null };
}

/** Appelée seulement quand chaque ingrédient est résolu. */
function enRecetteNouvelle(
  recette: RecetteProposee,
  ingredients: readonly IngredientAControler[],
): RecetteNouvelle {
  return {
    title: recette.title,
    servings: recette.servings,
    steps: recette.steps,
    lignes: recette.ingredients.map(({ quantity, unit }, rang) => ({
      ingredientId: ingredients[rang].ingredientId as string,
      quantity: auMillieme(quantity),
      unit,
    })),
  };
}

/** La base garde la quantité au millième : une quantité positive ne s'y arrondit pas à zéro. */
function auMillieme(quantite: number): number {
  return Math.max(Math.round(quantite * 1000) / 1000, 0.001);
}

/** Le créneau tel que le contrat le rend, sans la lecture seule de la machine. */
function enCreneau({
  day,
  moment,
  participantIds,
  guestCount,
}: Creneau): RejectedSlot['slot'] {
  return { day, moment, participantIds: [...participantIds], guestCount };
}
