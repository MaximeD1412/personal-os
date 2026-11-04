import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiNoContentResponse } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { Espaces } from '../espace/espaces.decorator';
import {
  TrainingGoalDto,
  TrainingGoalInputDto,
  TrainingGoalUpdateDto,
  TrainingSeriesInputDto,
} from './training-goal.dto';
import { TrainingGoalService } from './training-goal.service';
import { TrainingSessionDto } from './training-session.dto';

/**
 * Les Objectifs sportifs, dans l'Espace personnel seul : chaque Compte ne voit
 * que les siens (ADR 0014). Ils se lisent en entier, comme un catalogue : un
 * Compte n'en prépare que quelques-uns (ADR 0030).
 *
 * Une série est une création de Séances : un `POST` sur la collection
 * imbriquée (ADR 0030). Elle ne laisse aucune trace d'elle-même, seulement
 * des Séances liées à l'Objectif (ADR 0022).
 */
@Controller('training-goals')
@Espaces('PERSONAL')
export class TrainingGoalController {
  constructor(private readonly objectifs: TrainingGoalService) {}

  @Get()
  @ZodResponse({ status: 200, type: [TrainingGoalDto] })
  lister() {
    return this.objectifs.lister();
  }

  @Get(':id')
  @ZodResponse({ status: 200, type: TrainingGoalDto })
  lire(@Param('id') id: string) {
    return this.objectifs.lire(id);
  }

  @Post()
  @ZodResponse({ status: 201, type: TrainingGoalDto })
  creer(@Body() saisie: TrainingGoalInputDto) {
    return this.objectifs.creer(saisie);
  }

  @Patch(':id')
  @ZodResponse({ status: 200, type: TrainingGoalDto })
  modifier(@Param('id') id: string, @Body() saisie: TrainingGoalUpdateDto) {
    return this.objectifs.modifier(id, saisie);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  supprimer(@Param('id') id: string): Promise<void> {
    return this.objectifs.supprimer(id);
  }

  /** Les Séances liées à l'Objectif : la liste est bornée par lui. */
  @Get(':id/sessions')
  @ZodResponse({ status: 200, type: [TrainingSessionDto] })
  seances(@Param('id') id: string) {
    return this.objectifs.seancesDe(id);
  }

  @Post(':id/sessions')
  @ZodResponse({ status: 201, type: [TrainingSessionDto] })
  creerLaSerie(@Param('id') id: string, @Body() serie: TrainingSeriesInputDto) {
    return this.objectifs.creerLaSerie(id, serie);
  }
}
