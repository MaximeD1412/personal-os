import {
  zShoppingGap,
  zShoppingList,
  zShoppingListItem,
  zShoppingListItemInput,
  zShoppingListProductionQuery,
  zShoppingListQuery,
} from '@personal-os/contracts';
import { createZodDto } from 'nestjs-zod';

/*
 * Les DTO ne font que porter les schémas de `contracts` jusqu'à Nest (ADR
 * 0030) : aucun schéma ne se définit ici.
 */

export class ShoppingListDto extends createZodDto(zShoppingList) {}

export class ShoppingListItemDto extends createZodDto(zShoppingListItem) {}

export class ShoppingListQueryDto extends createZodDto(zShoppingListQuery) {}

export class ShoppingListItemInputDto extends createZodDto(
  zShoppingListItemInput,
) {}

export class ShoppingListProductionQueryDto extends createZodDto(
  zShoppingListProductionQuery,
) {}

export class ShoppingGapDto extends createZodDto(zShoppingGap) {}
