import {
  zProject,
  zProjectExpense,
  zProjectExpenseInput,
  zProjectInput,
  zProjectSummary,
  zProjectUpdate,
} from '@personal-os/contracts';
import { createZodDto } from 'nestjs-zod';

/*
 * Les DTO ne font que porter les schémas de `contracts` jusqu'à Nest : le pipe
 * global valide les entrées, le sérialiseur borne les sorties, et l'OpenAPI se
 * déduit des deux (ADR 0030). Aucun schéma ne se définit ici.
 */

export class ProjectDto extends createZodDto(zProject) {}

export class ProjectSummaryDto extends createZodDto(zProjectSummary) {}

export class ProjectInputDto extends createZodDto(zProjectInput) {}

export class ProjectUpdateDto extends createZodDto(zProjectUpdate) {}

export class ProjectExpenseDto extends createZodDto(zProjectExpense) {}

export class ProjectExpenseInputDto extends createZodDto(
  zProjectExpenseInput,
) {}
