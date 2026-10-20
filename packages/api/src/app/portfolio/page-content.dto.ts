import {
  zPageContent,
  zPageContentInput,
  zPageContentKey,
} from '@personal-os/contracts';
import { createZodDto } from 'nestjs-zod';

/*
 * Les DTO ne font que porter les schémas de `contracts` jusqu'à Nest : le pipe
 * global valide les entrées, le sérialiseur borne les sorties, et l'OpenAPI se
 * déduit des deux (ADR 0030). Aucun schéma ne se définit ici.
 */

export class PageContentDto extends createZodDto(zPageContent) {}

export class PageContentInputDto extends createZodDto(zPageContentInput) {}

export class PageContentKeyDto extends createZodDto(zPageContentKey) {}
