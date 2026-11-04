import { zModuleSummary, zTodo } from '@personal-os/contracts';
import { createZodDto } from 'nestjs-zod';

/* Les schémas viennent de `contracts` ; ces classes ne font que les porter jusqu'à Nest. */

export class ModuleSummaryDto extends createZodDto(zModuleSummary) {}

export class TodoDto extends createZodDto(zTodo) {}
