import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';
import { Espaces } from '../espace/espaces.decorator';
import {
  PublicPresentationDto,
  PublicPresentationInputDto,
  PublicPresentationKeyDto,
} from './presentation.dto';
import { PresentationService } from './presentation.service';

/**
 * Les Présentations publiques d'un Projet, une par langue. Elles vivent dans
 * l'Espace personnel de leur Projet : celles de l'autre Compte sont
 * introuvables, en lecture comme en écriture (ADR 0019, 0030). L'État de
 * publication ne change que par ses transitions, jamais par la rédaction.
 */
@Controller('projects/:id/presentations')
@Espaces('PERSONAL')
export class PresentationController {
  constructor(private readonly presentations: PresentationService) {}

  /** Au plus une présentation par langue : la liste est bornée par nature. */
  @Get()
  @ZodResponse({ status: 200, type: [PublicPresentationDto] })
  lister(@Param('id') id: string) {
    return this.presentations.lister(id);
  }

  /** Crée la présentation de cette langue, ou en remplace le texte. */
  @Put(':lang')
  @ZodResponse({ status: 200, type: PublicPresentationDto })
  rediger(
    @Param() { id, lang }: PublicPresentationKeyDto,
    @Body() saisie: PublicPresentationInputDto,
  ) {
    return this.presentations.rediger(id, lang, saisie);
  }

  @Post(':lang/ready')
  @HttpCode(200)
  @ZodResponse({ status: 200, type: PublicPresentationDto })
  marquerPrete(@Param() { id, lang }: PublicPresentationKeyDto) {
    return this.presentations.transition(id, lang, 'ready');
  }

  @Post(':lang/publish')
  @HttpCode(200)
  @ZodResponse({ status: 200, type: PublicPresentationDto })
  publier(@Param() { id, lang }: PublicPresentationKeyDto) {
    return this.presentations.transition(id, lang, 'publish');
  }

  @Post(':lang/unpublish')
  @HttpCode(200)
  @ZodResponse({ status: 200, type: PublicPresentationDto })
  depublier(@Param() { id, lang }: PublicPresentationKeyDto) {
    return this.presentations.transition(id, lang, 'unpublish');
  }
}
