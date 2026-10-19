import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';
import { Espaces } from '../espace/espaces.decorator';
import {
  CommandResolutionDto,
  CommandResolveInputDto,
  UnresolvedCommandListQueryDto,
  UnresolvedCommandPageDto,
} from './command-bar.dto';
import { CommandBarService } from './command-bar.service';

/**
 * La barre de commande (ADR 0018). La résolution ne crée aucune ressource :
 * elle répond 200. Elle atteint l'Espace personnel de l'auteur, où une
 * commande non comprise se journalise, et l'Espace foyer, où le port IA trace
 * son appel. Le journal se lit par curseur (ADR 0030), dans l'Espace
 * personnel seul.
 */
@Controller('command-bar')
export class CommandBarController {
  constructor(private readonly barre: CommandBarService) {}

  @Post('resolve')
  @HttpCode(200)
  @Espaces('PERSONAL', 'HOUSEHOLD')
  @ZodResponse({ status: 200, type: CommandResolutionDto })
  resoudre(@Body() { text }: CommandResolveInputDto) {
    return this.barre.resoudre(text);
  }

  @Get('unresolved')
  @Espaces('PERSONAL')
  @ZodResponse({ status: 200, type: UnresolvedCommandPageDto })
  lister(@Query() query: UnresolvedCommandListQueryDto) {
    return this.barre.page(query);
  }
}
