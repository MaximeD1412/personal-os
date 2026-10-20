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
import { Espaces } from '../espace/espaces.decorator';
import {
  RecipeDto,
  RecipeInputDto,
  RecipeListQueryDto,
  RecipeUpdateDto,
} from './recipe.dto';
import { RecipeService } from './recipe.service';

/**
 * Les Recettes du Foyer. La Cuisine n'accepte que l'Espace foyer : les deux
 * Comptes lisent et modifient les mêmes recettes, et une saisie ne choisit
 * pas d'Espace, le module le pose (ADR 0030).
 */
@Controller('recipes')
@Espaces('HOUSEHOLD')
export class RecipeController {
  constructor(private readonly recettes: RecipeService) {}

  @Get()
  @ZodResponse({ status: 200, type: [RecipeDto] })
  lister(@Query() requete: RecipeListQueryDto) {
    return this.recettes.lister(requete);
  }

  @Get(':id')
  @ZodResponse({ status: 200, type: RecipeDto })
  lire(@Param('id') id: string) {
    return this.recettes.lire(id);
  }

  @Post()
  @ZodResponse({ status: 201, type: RecipeDto })
  creer(@Body() saisie: RecipeInputDto) {
    return this.recettes.creer(saisie);
  }

  @Patch(':id')
  @ZodResponse({ status: 200, type: RecipeDto })
  modifier(@Param('id') id: string, @Body() saisie: RecipeUpdateDto) {
    return this.recettes.modifier(id, saisie);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  supprimer(@Param('id') id: string): Promise<void> {
    return this.recettes.supprimer(id);
  }
}
