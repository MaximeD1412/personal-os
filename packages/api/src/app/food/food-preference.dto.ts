import {
  zFoodPreference,
  zFoodPreferenceInput,
  zFoodPreferenceListQuery,
} from '@personal-os/contracts';
import { createZodDto } from 'nestjs-zod';

/*
 * Les DTO ne font que porter les schémas de `contracts` jusqu'à Nest (ADR
 * 0030). Aucun schéma ne se définit ici.
 */

/**
 * Une union ne fait pas une classe : ces DTO restent la valeur que rend
 * `createZodDto`. Anonymes, ils prendraient dans l'OpenAPI le nom générique
 * de `nestjs-zod`, qu'un autre DTO porte déjà : ils reçoivent donc le leur.
 */
export const FoodPreferenceDto = nommer(
  createZodDto(zFoodPreference),
  'FoodPreferenceDto',
);

/**
 * Pour la même raison, le type du paramètre ne le désigne pas : le pipe
 * global ne le verrait pas, et le contrôleur le passe donc à son propre pipe.
 */
export const FoodPreferenceInputDto = nommer(
  createZodDto(zFoodPreferenceInput),
  'FoodPreferenceInputDto',
);

export class FoodPreferenceListQueryDto extends createZodDto(
  zFoodPreferenceListQuery,
) {}

function nommer<T extends abstract new (...args: never[]) => unknown>(
  dto: T,
  nom: string,
): T {
  Object.defineProperty(dto, 'name', { value: nom });
  return dto;
}
