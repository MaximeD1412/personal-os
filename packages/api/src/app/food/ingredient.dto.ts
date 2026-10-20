import {
  zIngredient,
  zIngredientAlias,
  zIngredientAliasInput,
  zIngredientInput,
  zIngredientListQuery,
  zIngredientResolution,
  zIngredientResolveInput,
  zIngredientUpdate,
} from '@personal-os/contracts';
import { createZodDto } from 'nestjs-zod';

/*
 * Les DTO ne font que porter les schémas de `contracts` jusqu'à Nest : le pipe
 * global valide les entrées, le sérialiseur borne les sorties, et l'OpenAPI se
 * déduit des deux (ADR 0030). Aucun schéma ne se définit ici.
 */

export class IngredientDto extends createZodDto(zIngredient) {}

export class IngredientInputDto extends createZodDto(zIngredientInput) {}

export class IngredientUpdateDto extends createZodDto(zIngredientUpdate) {}

export class IngredientListQueryDto extends createZodDto(
  zIngredientListQuery,
) {}

export class IngredientResolveInputDto extends createZodDto(
  zIngredientResolveInput,
) {}

/** Une union ne fait pas une classe : ce DTO reste la valeur que rend `createZodDto`. */
export const IngredientResolutionDto = createZodDto(zIngredientResolution);

export class IngredientAliasDto extends createZodDto(zIngredientAlias) {}

export class IngredientAliasInputDto extends createZodDto(
  zIngredientAliasInput,
) {}
