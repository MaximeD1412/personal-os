import { zHousehold } from '@personal-os/contracts';
import { createZodDto } from 'nestjs-zod';

/* Le DTO ne fait que porter le schéma de `contracts` jusqu'à Nest (ADR 0030). */

export class HouseholdDto extends createZodDto(zHousehold) {}
