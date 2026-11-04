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
  ProjectDto,
  ProjectExpenseDto,
  ProjectExpenseInputDto,
  ProjectInputDto,
  ProjectSummaryDto,
  ProjectUpdateDto,
} from './project.dto';
import { ProjectService } from './project.service';

/**
 * Un Projet vit dans l'Espace personnel, et lui seul : le Projet de l'autre
 * Compte est introuvable, en lecture comme en écriture (ADR 0019, 0030).
 */
@Controller('projects')
@Espaces('PERSONAL')
export class ProjectController {
  constructor(private readonly projets: ProjectService) {}

  /**
   * Tous les Projets du Compte, du plus récemment modifié au plus ancien. La
   * liste est bornée par nature : une personne mène quelques dizaines de
   * Projets, pas des milliers (ADR 0030).
   */
  @Get()
  @ZodResponse({ status: 200, type: [ProjectSummaryDto] })
  lister() {
    return this.projets.lister();
  }

  @Get(':id')
  @ZodResponse({ status: 200, type: ProjectDto })
  lire(@Param('id') id: string) {
    return this.projets.lire(id);
  }

  @Post()
  @ZodResponse({ status: 201, type: ProjectDto })
  creer(@Body() saisie: ProjectInputDto) {
    return this.projets.creer(saisie);
  }

  @Patch(':id')
  @ZodResponse({ status: 200, type: ProjectDto })
  modifier(@Param('id') id: string, @Body() saisie: ProjectUpdateDto) {
    return this.projets.modifier(id, saisie);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  supprimer(@Param('id') id: string): Promise<void> {
    return this.projets.supprimer(id);
  }

  @Post(':id/expenses')
  @ZodResponse({ status: 201, type: ProjectExpenseDto })
  ajouterUneDepense(
    @Param('id') id: string,
    @Body() saisie: ProjectExpenseInputDto,
  ) {
    return this.projets.ajouterUneDepense(id, saisie);
  }

  @Delete(':id/expenses/:expenseId')
  @HttpCode(204)
  @ApiNoContentResponse()
  retirerUneDepense(
    @Param('id') id: string,
    @Param('expenseId') expenseId: string,
  ): Promise<void> {
    return this.projets.retirerUneDepense(id, expenseId);
  }
}
