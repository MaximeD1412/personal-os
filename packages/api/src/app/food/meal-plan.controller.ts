import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiNoContentResponse } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import type { UserRecord } from '../auth/auth.repository';
import { CurrentUser } from '../auth/current-user.decorator';
import { Espaces } from '../espace/espaces.decorator';
import {
  MealPlanDto,
  MealPlanEntryDto,
  MealPlanEntryInputDto,
  MealPlanEntryUpdateDto,
  MealPlanQueryDto,
} from './meal-plan.dto';
import { MealPlanService } from './meal-plan.service';

/**
 * Les Plannings de repas du Foyer, un par semaine. La Cuisine n'accepte que
 * l'Espace foyer : les deux Comptes lisent et modifient le même planning, et
 * une saisie ne choisit pas d'Espace, le module le pose (ADR 0030).
 */
@Controller('meal-plans')
@Espaces('HOUSEHOLD')
export class MealPlanController {
  constructor(private readonly plannings: MealPlanService) {}

  @Get()
  @ZodResponse({ status: 200, type: MealPlanDto })
  lire(@Query() requete: MealPlanQueryDto) {
    return this.plannings.lire(requete);
  }

  @Post(':id/entries')
  @ZodResponse({ status: 201, type: MealPlanEntryDto })
  ajouter(
    @Param('id') id: string,
    @Body() saisie: MealPlanEntryInputDto,
    @CurrentUser() compte: UserRecord,
  ) {
    return this.plannings.ajouter(id, saisie, compte.id);
  }

  @Patch(':id/entries/:entryId')
  @ZodResponse({ status: 200, type: MealPlanEntryDto })
  modifier(
    @Param('id') id: string,
    @Param('entryId') entryId: string,
    @Body() saisie: MealPlanEntryUpdateDto,
    @CurrentUser() compte: UserRecord,
  ) {
    return this.plannings.modifier(id, entryId, saisie, compte.id);
  }

  @Delete(':id/entries/:entryId')
  @HttpCode(204)
  @ApiNoContentResponse()
  supprimer(
    @Param('id') id: string,
    @Param('entryId') entryId: string,
  ): Promise<void> {
    return this.plannings.supprimer(id, entryId);
  }

  @Post(':id/stop')
  @HttpCode(200)
  @ZodResponse({ status: 200, type: MealPlanDto })
  arreter(@Param('id') id: string) {
    return this.plannings.arreter(id);
  }

  @Post(':id/reopen')
  @HttpCode(200)
  @ZodResponse({ status: 200, type: MealPlanDto })
  rouvrir(@Param('id') id: string) {
    return this.plannings.rouvrir(id);
  }
}
