import { Controller, Get, Param } from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';
import { Espaces } from '../espace/espaces.decorator';
import { MealPlanEntryDto } from './meal-plan.dto';
import { MealPlanService } from './meal-plan.service';

/**
 * Un Repas planifié lu seul, par son identifiant : l'écran qui le déclare
 * cuisiné ne reçoit que lui. Ses écritures restent sous son planning.
 */
@Controller('meal-plan-entries')
@Espaces('HOUSEHOLD')
export class MealPlanEntryController {
  constructor(private readonly plannings: MealPlanService) {}

  @Get(':id')
  @ZodResponse({ status: 200, type: MealPlanEntryDto })
  lire(@Param('id') id: string) {
    return this.plannings.lireLeRepas(id);
  }
}
