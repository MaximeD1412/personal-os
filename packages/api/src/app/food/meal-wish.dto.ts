import {
  zMealWish,
  zMealWishInput,
  zMealWishListQuery,
} from '@personal-os/contracts';
import { createZodDto } from 'nestjs-zod';

/*
 * Les DTO ne font que porter les schémas de `contracts` jusqu'à Nest (ADR
 * 0030) : aucun schéma ne se définit ici.
 */

export class MealWishDto extends createZodDto(zMealWish) {}

export class MealWishInputDto extends createZodDto(zMealWishInput) {}

export class MealWishListQueryDto extends createZodDto(zMealWishListQuery) {}
