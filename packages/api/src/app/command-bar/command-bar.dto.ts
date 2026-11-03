import {
  zCommandResolution,
  zCommandResolveInput,
  zUnresolvedCommandListQuery,
  zUnresolvedCommandPage,
} from '@personal-os/contracts';
import { createZodDto } from 'nestjs-zod';

/*
 * Les DTO ne font que porter les schémas de `contracts` jusqu'à Nest (ADR 0030).
 * Aucun schéma ne se définit ici.
 */

export class CommandResolveInputDto extends createZodDto(
  zCommandResolveInput,
) {}

/** Une union ne fait pas une classe : ce DTO reste la valeur que rend `createZodDto`. */
export const CommandResolutionDto = createZodDto(zCommandResolution);

export class UnresolvedCommandListQueryDto extends createZodDto(
  zUnresolvedCommandListQuery,
) {}

export class UnresolvedCommandPageDto extends createZodDto(
  zUnresolvedCommandPage,
) {}
