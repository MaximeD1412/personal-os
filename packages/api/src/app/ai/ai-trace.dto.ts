import {
  zAiTrace,
  zAiTraceListQuery,
  zAiTracePage,
} from '@personal-os/contracts';
import { createZodDto } from 'nestjs-zod';

/*
 * Les DTO ne font que porter les schémas de `contracts` jusqu'à Nest (ADR 0030).
 * Aucun schéma ne se définit ici.
 */

export class AiTraceDto extends createZodDto(zAiTrace) {}

export class AiTracePageDto extends createZodDto(zAiTracePage) {}

export class AiTraceListQueryDto extends createZodDto(zAiTraceListQuery) {}
