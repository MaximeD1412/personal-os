import {
  zPreferredProductInput,
  zProduct,
  zProductInput,
  zProductUpdate,
} from '@personal-os/contracts';
import { createZodDto } from 'nestjs-zod';

/* Les DTO ne font que porter les schémas de `contracts` jusqu'à Nest (ADR 0030). */

export class ProductDto extends createZodDto(zProduct) {}

export class ProductInputDto extends createZodDto(zProductInput) {}

export class ProductUpdateDto extends createZodDto(zProductUpdate) {}

export class PreferredProductInputDto extends createZodDto(
  zPreferredProductInput,
) {}
