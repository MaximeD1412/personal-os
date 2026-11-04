import { zAgendaItem, zAgendaPeriod } from '@personal-os/contracts';
import { createZodDto } from 'nestjs-zod';

/* Les schémas viennent de `contracts` ; ces classes ne font que les porter jusqu'à Nest. */

export class AgendaItemDto extends createZodDto(zAgendaItem) {}

export class AgendaPeriodDto extends createZodDto(zAgendaPeriod) {}
