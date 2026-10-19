import { Controller, Get, Param, Query } from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';
import { Espaces } from '../espace/espaces.decorator';
import {
  AiTraceDto,
  AiTraceListQueryDto,
  AiTracePageDto,
} from './ai-trace.dto';
import { AiTraceService } from './ai-trace.service';

/**
 * Le journal des appels au modèle d'IA, dans l'Espace foyer : la génération
 * du planning et la barre de commande servent le Foyer entier. Un journal en
 * ajout seul se lit par curseur (ADR 0030) ; le texte de l'échange ne se lit
 * que trace par trace.
 */
@Controller('ai-traces')
@Espaces('HOUSEHOLD')
export class AiTraceController {
  constructor(private readonly traces: AiTraceService) {}

  @Get()
  @ZodResponse({ status: 200, type: AiTracePageDto })
  lister(@Query() query: AiTraceListQueryDto) {
    return this.traces.page(query);
  }

  @Get(':id')
  @ZodResponse({ status: 200, type: AiTraceDto })
  lire(@Param('id') id: string) {
    return this.traces.lire(id);
  }
}
