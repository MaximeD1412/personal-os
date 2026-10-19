import { Injectable } from '@nestjs/common';
import {
  normaliserLibelle,
  UNITES_AVEC_POIDS_A_LA_PIECE,
  type CanonicalUnit,
  type Ingredient,
  type IngredientInput,
  type IngredientListQuery,
  type IngredientUpdate,
} from '@personal-os/contracts';
import { ErreurMetier, Introuvable } from '../erreurs/erreur-metier';
import {
  IngredientRepository,
  type IngredientRecord,
  type IngredientWrite,
} from './ingredient.repository';

/**
 * Les saisies arrivent validées par leur schéma (ADR 0030) : il ne reste ici
 * que ce qu'un schéma ne peut pas juger seul. Un nom déjà pris, un poids à la
 * pièce sur un Ingrédient compté en millilitres (une modification peut n'en
 * porter qu'un des deux, l'autre est en base), une modification vide, un
 * Ingrédient introuvable.
 */
@Injectable()
export class IngredientService {
  constructor(private readonly repository: IngredientRepository) {}

  /** Tout le catalogue, ou les Ingrédients dont le nom contient chaque mot de `q`. */
  async lister({ q }: IngredientListQuery): Promise<Ingredient[]> {
    const mots = normaliserLibelle(q ?? '')
      .split(' ')
      .filter(Boolean);

    return (await this.repository.lister(mots)).map(exposer);
  }

  async lire(id: string): Promise<Ingredient> {
    return exposer(await this.existant(id));
  }

  async creer(saisie: IngredientInput): Promise<Ingredient> {
    verifierLePoidsALaPiece(saisie.canonicalUnit, saisie.gramsPerPiece);

    return exposer(
      await uniqueSinon(
        this.repository.creer({
          ...saisie,
          name: normaliserLibelle(saisie.displayName),
        }),
      ),
    );
  }

  async modifier(id: string, saisie: IngredientUpdate): Promise<Ingredient> {
    const changements = enChangements(saisie);

    if (Object.keys(changements).length === 0) {
      throw new ErreurMetier(
        'food.ingredient_empty_update',
        'La modification ne change rien.',
      );
    }

    const actuel = await this.existant(id);
    verifierLePoidsALaPiece(
      changements.canonicalUnit ?? actuel.canonicalUnit,
      changements.gramsPerPiece !== undefined
        ? changements.gramsPerPiece
        : actuel.gramsPerPiece,
    );

    return exposer(
      await uniqueSinon(this.repository.modifier(id, changements)),
    );
  }

  private async existant(id: string): Promise<IngredientRecord> {
    const ingredient = await this.repository.lire(id);
    if (!ingredient) {
      throw new Introuvable(
        'food.ingredient_not_found',
        'Aucun Ingrédient de cet identifiant.',
      );
    }
    return ingredient;
  }
}

/**
 * Un poids à la pièce relie des grammes et des pièces : il n'a pas de sens
 * pour un Ingrédient compté en millilitres.
 */
function verifierLePoidsALaPiece(
  unite: CanonicalUnit,
  grammesParPiece: number | null,
): void {
  if (
    grammesParPiece !== null &&
    !UNITES_AVEC_POIDS_A_LA_PIECE.includes(unite)
  ) {
    throw poidsNonApplicable();
  }
}

function poidsNonApplicable(): ErreurMetier {
  return new ErreurMetier(
    'food.grams_per_piece_not_applicable',
    'Un poids à la pièce ne vaut que pour un Ingrédient compté en grammes ou en pièces.',
  );
}

/**
 * Le nom normalisé est unique en base, et une contrainte y réserve le poids à
 * la pièce aux grammes et aux pièces : c'est elle qui tranche entre deux
 * saisies simultanées. Ses refus deviennent les règles du catalogue.
 */
async function uniqueSinon(
  operation: Promise<IngredientRecord>,
): Promise<IngredientRecord> {
  try {
    return await operation;
  } catch (erreur) {
    if (codePrisma(erreur) === 'P2002') {
      throw new ErreurMetier(
        'food.ingredient_duplicate',
        'Un Ingrédient du catalogue porte déjà ce nom.',
      );
    }
    if (violeLaContrainteDuPoids(erreur)) {
      throw poidsNonApplicable();
    }
    if (codePrisma(erreur) === 'P2025') {
      throw new Introuvable(
        'food.ingredient_not_found',
        'Aucun Ingrédient de cet identifiant.',
      );
    }
    throw erreur;
  }
}

/** Une modification ne porte que ce qu'elle change ; un libellé renomme. */
function enChangements(saisie: IngredientUpdate): Partial<IngredientWrite> {
  const changements: Partial<IngredientWrite> = {};

  if (saisie.displayName !== undefined) {
    changements.displayName = saisie.displayName;
    changements.name = normaliserLibelle(saisie.displayName);
  }
  if (saisie.canonicalUnit !== undefined) {
    changements.canonicalUnit = saisie.canonicalUnit;
  }
  if (saisie.gramsPerPiece !== undefined) {
    changements.gramsPerPiece = saisie.gramsPerPiece;
  }
  if (saisie.allergens !== undefined) {
    changements.allergens = saisie.allergens;
  }
  if (saisie.perishable !== undefined) {
    changements.perishable = saisie.perishable;
  }

  return changements;
}

/** Le refus de `Ingredient_gramsPerPiece_unit_check`, tel que Prisma le relaie. */
function violeLaContrainteDuPoids(erreur: unknown): boolean {
  if (codePrisma(erreur) !== 'P2039') {
    return false;
  }
  const cause = (
    erreur as {
      meta?: {
        driverAdapterError?: {
          cause?: { originalCode?: string; originalMessage?: string };
        };
      };
    }
  ).meta?.driverAdapterError?.cause;

  return (
    cause?.originalCode === '23514' &&
    (cause.originalMessage ?? '').includes(
      'Ingredient_gramsPerPiece_unit_check',
    )
  );
}

function codePrisma(erreur: unknown): unknown {
  return typeof erreur === 'object' && erreur !== null && 'code' in erreur
    ? erreur.code
    : undefined;
}

function exposer(ingredient: IngredientRecord): Ingredient {
  return {
    id: ingredient.id,
    name: ingredient.name,
    displayName: ingredient.displayName,
    canonicalUnit: ingredient.canonicalUnit,
    gramsPerPiece: ingredient.gramsPerPiece,
    allergens: ingredient.allergens,
    perishable: ingredient.perishable,
    createdAt: ingredient.createdAt.toISOString(),
  };
}
