import {
  zEvent,
  zEventInput,
  zEventListQuery,
  zEventUpdate,
} from '@personal-os/contracts';
import { createZodDto } from 'nestjs-zod';

/*
 * Les DTO ne font que porter les schémas de `contracts` jusqu'à Nest : le pipe
 * global valide les entrées, le sérialiseur borne les sorties, et l'OpenAPI se
 * déduit des deux (ADR 0030). Aucun schéma ne se définit ici.
 */

export class EventDto extends createZodDto(zEvent) {}

export class EventInputDto extends createZodDto(zEventInput) {}

export class EventUpdateDto extends createZodDto(zEventUpdate) {}

export class EventListQueryDto extends createZodDto(zEventListQuery) {}
