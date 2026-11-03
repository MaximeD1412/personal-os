import { zCookedMeal, zCookedMealInput } from '@personal-os/contracts';
import { createZodDto } from 'nestjs-zod';

/*
 * Les DTO ne font que porter les schémas de `contracts` jusqu'à Nest (ADR
 * 0030) : aucun schéma ne se définit ici.
 */

export class CookedMealDto extends createZodDto(zCookedMeal) {}

export class CookedMealInputDto extends createZodDto(zCookedMealInput) {}
