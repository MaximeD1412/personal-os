import { Body, Controller, Param, Post } from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';
import type { UserRecord } from '../auth/auth.repository';
import { CurrentUser } from '../auth/current-user.decorator';
import { Espaces } from '../espace/espaces.decorator';
import { GenerationRoundDto, GenerationRoundInputDto } from './meal-plan.dto';
import { GenerationRoundService } from './generation-round.service';

/**
 * Les Tours de génération d'un Planning de repas : l'IA propose, le contrôle
 * écarte ce qui n'est pas sûr, et on statue sur chacun des repas proposés
 * (`POST /meal-plans/:id/entries/:entryId/decision`).
 */
@Controller('meal-plans')
@Espaces('HOUSEHOLD')
export class GenerationRoundController {
  constructor(private readonly tours: GenerationRoundService) {}

  @Post(':id/generation-rounds')
  @ZodResponse({ status: 201, type: GenerationRoundDto })
  lancer(
    @Param('id') id: string,
    @Body() saisie: GenerationRoundInputDto,
    @CurrentUser() compte: UserRecord,
  ) {
    return this.tours.lancer(id, saisie, compte.id);
  }
}
