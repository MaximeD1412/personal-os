import {
  zRecipe,
  zRecipeInput,
  zRecipeListQuery,
  zRecipeUpdate,
} from '@personal-os/contracts';
import { createZodDto } from 'nestjs-zod';

/*
 * Les DTO ne font que porter les schémas de `contracts` jusqu'à Nest (ADR
 * 0030) : aucun schéma ne se définit ici.
 */

export class RecipeDto extends createZodDto(zRecipe) {}

export class RecipeInputDto extends createZodDto(zRecipeInput) {}

export class RecipeUpdateDto extends createZodDto(zRecipeUpdate) {}

export class RecipeListQueryDto extends createZodDto(zRecipeListQuery) {}
