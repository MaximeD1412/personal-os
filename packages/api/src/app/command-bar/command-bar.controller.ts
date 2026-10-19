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
 * elle répond 200. Elle n'écrit que dans l'Espace personnel de l'auteur : la
 * trace de l'appel au modèle, et la commande si elle n'est pas comprise. Le
 * journal se lit par curseur (ADR 0030).
 */
@Controller('command-bar')
export class CommandBarController {
  constructor(private readonly barre: CommandBarService) {}

  @Post('resolve')
  @HttpCode(200)
  @Espaces('PERSONAL')
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
