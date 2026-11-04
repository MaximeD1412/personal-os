import { Injectable } from '@nestjs/common';
import {
  normaliserLibelle,
  type IngredientAlias,
  type IngredientAliasInput,
  type IngredientResolution,
} from '@personal-os/contracts';
import { ErreurMetier, Introuvable } from '../erreurs/erreur-metier';
import {
  IngredientAliasRepository,
  type IngredientAliasRecord,
} from './ingredient-alias.repository';
import { resoudre } from './resolution/resoudre';

/**
 * Le résolveur d'ingrédients et ses Alias. La résolution ne crée jamais
 * d'Alias : un rattachement est toujours un geste de l'utilisateur, par
 * `rattacher`.
 */
@Injectable()
export class IngredientAliasService {
  constructor(private readonly repository: IngredientAliasRepository) {}

  /** Un résultat par libellé, dans l'ordre de la demande. */
  async resoudre(labels: readonly string[]): Promise<IngredientResolution[]> {
    const catalogue = await this.repository.catalogue();

    return labels.map((label) => {
      const resolution = resoudre(label, catalogue);

      return 'ingredientId' in resolution
        ? { label, ingredientId: resolution.ingredientId }
        : { label, unknown: true, suggestions: resolution.suggestions };
    });
  }

  /**
   * Rattache un libellé à un Ingrédient. Un libellé ne désigne qu'un
   * Ingrédient : déjà rattaché à un autre, par un Alias ou parce que c'est son
   * nom, il est refusé. Déjà rattaché au même, l'Alias existant revient.
   */
  async rattacher({
    label,
    ingredientId,
  }: IngredientAliasInput): Promise<IngredientAlias> {
    const normalise = normaliserLibelle(label);

    if (!(await this.repository.ingredientExiste(ingredientId))) {
      throw new Introuvable(
        'food.ingredient_not_found',
        'Aucun Ingrédient de cet identifiant.',
      );
    }

    const existant = await this.repository.lire(normalise);
    if (existant) return exposer(memeIngredientSinon(existant, ingredientId));

    const homonyme = await this.repository.ingredientNomme(normalise);
    if (homonyme && homonyme.id !== ingredientId) throw conflit();

    try {
      return exposer(
        await this.repository.creer({ label: normalise, ingredientId }),
      );
    } catch (erreur) {
      // Un rattachement simultané du même libellé : l'unicité en base tranche,
      // et on juge celui qui a gagné comme s'il était arrivé avant.
      const gagnant =
        codePrisma(erreur) === 'P2002'
          ? await this.repository.lire(normalise)
          : null;
      if (gagnant) return exposer(memeIngredientSinon(gagnant, ingredientId));
      throw erreur;
    }
  }
}

function memeIngredientSinon(
  alias: IngredientAliasRecord,
  ingredientId: string,
): IngredientAliasRecord {
  if (alias.ingredientId !== ingredientId) throw conflit();
  return alias;
}

function conflit(): ErreurMetier {
  return new ErreurMetier(
    'food.alias_conflict',
    'Ce libellé désigne déjà un autre Ingrédient.',
  );
}

function codePrisma(erreur: unknown): unknown {
  return typeof erreur === 'object' && erreur !== null && 'code' in erreur
    ? erreur.code
    : undefined;
}

function exposer(alias: IngredientAliasRecord): IngredientAlias {
  return {
    id: alias.id,
    label: alias.label,
    ingredientId: alias.ingredientId,
    createdAt: alias.createdAt.toISOString(),
  };
}
