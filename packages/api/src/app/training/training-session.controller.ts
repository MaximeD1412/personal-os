import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';
import { Command } from '../command-bar/command.decorator';
import { Espaces } from '../espace/espaces.decorator';
import {
  TrainingSessionCompletionDto,
  TrainingSessionDto,
  TrainingSessionInputDto,
  TrainingSessionListQueryDto,
  TrainingSessionUpdateDto,
} from './training-session.dto';
import { TrainingSessionService } from './training-session.service';

/**
 * Le sport est personnel : le module n'accepte que l'Espace personnel, et
 * chaque Compte ne voit que ses Séances (ADR 0014).
 *
 * Le statut ne change que par une action (`complete`, `miss`), jamais par la
 * modification : le schéma du PATCH ne le contient pas (ADR 0030).
 */
@Controller('training-sessions')
@Espaces('PERSONAL')
export class TrainingSessionController {
  constructor(private readonly seances: TrainingSessionService) {}

  @Get()
  @ZodResponse({ status: 200, type: [TrainingSessionDto] })
  lister(@Query() periode: TrainingSessionListQueryDto) {
    return this.seances.lister(periode);
  }

  @Get(':id')
  @ZodResponse({ status: 200, type: TrainingSessionDto })
  lire(@Param('id') id: string) {
    return this.seances.lire(id);
  }

  @Post()
  @ZodResponse({ status: 201, type: TrainingSessionDto })
  @Command({
    intent: 'Créer une Séance de sport, prévue ou déjà réalisée',
    examples: [
      'footing de 10 km demain à 7 h',
      'séance de muscu jeudi à 19 h',
      'prévois 45 minutes de vélo samedi à 9 h',
      "j'ai nagé 1 500 m ce midi",
      'fractionné 8 × 400 m mardi à 18 h 30',
    ],
    screen: '/sport/seances/nouvelle',
    params: {
      sport: 'optional',
      startsAt: 'optional',
      status: 'optional',
      plannedDistanceM: 'optional',
      plannedDurationS: 'optional',
      plannedIntent: 'optional',
      actualDistanceM: 'optional',
      actualDurationS: 'optional',
    },
  })
  creer(@Body() saisie: TrainingSessionInputDto) {
    return this.seances.creer(saisie);
  }

  @Patch(':id')
  @ZodResponse({ status: 200, type: TrainingSessionDto })
  modifier(@Param('id') id: string, @Body() saisie: TrainingSessionUpdateDto) {
    return this.seances.modifier(id, saisie);
  }

  @Post(':id/complete')
  @HttpCode(200)
  @ZodResponse({ status: 200, type: TrainingSessionDto })
  completer(
    @Param('id') id: string,
    @Body() realise: TrainingSessionCompletionDto,
  ) {
    return this.seances.completer(id, realise);
  }

  @Post(':id/miss')
  @HttpCode(200)
  @ZodResponse({ status: 200, type: TrainingSessionDto })
  manquer(@Param('id') id: string) {
    return this.seances.manquer(id);
  }
}
