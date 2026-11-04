import {
  zPublicPresentation,
  zPublicPresentationInput,
  zPublicPresentationKey,
} from '@personal-os/contracts';
import { createZodDto } from 'nestjs-zod';

/*
 * Les DTO ne font que porter les schémas de `contracts` jusqu'à Nest : le pipe
 * global valide les entrées, le sérialiseur borne les sorties, et l'OpenAPI se
 * déduit des deux (ADR 0030). Aucun schéma ne se définit ici.
 */

export class PublicPresentationDto extends createZodDto(zPublicPresentation) {}

export class PublicPresentationInputDto extends createZodDto(
  zPublicPresentationInput,
) {}

export class PublicPresentationKeyDto extends createZodDto(
  zPublicPresentationKey,
) {}
