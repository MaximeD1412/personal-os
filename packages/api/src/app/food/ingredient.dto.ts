import {
  zIngredient,
  zIngredientInput,
  zIngredientListQuery,
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
