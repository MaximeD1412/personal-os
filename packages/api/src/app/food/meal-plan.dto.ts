import {
  zMealPlan,
  zMealPlanEntry,
  zMealPlanEntryInput,
  zMealPlanEntryUpdate,
  zMealPlanQuery,
} from '@personal-os/contracts';
import { createZodDto } from 'nestjs-zod';

/*
 * Les DTO ne font que porter les schémas de `contracts` jusqu'à Nest (ADR
 * 0030) : aucun schéma ne se définit ici.
 */

export class MealPlanDto extends createZodDto(zMealPlan) {}

export class MealPlanEntryDto extends createZodDto(zMealPlanEntry) {}

export class MealPlanEntryInputDto extends createZodDto(zMealPlanEntryInput) {}

export class MealPlanEntryUpdateDto extends createZodDto(
  zMealPlanEntryUpdate,
) {}

export class MealPlanQueryDto extends createZodDto(zMealPlanQuery) {}
