import { Body, Controller, Post } from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';
import { IngredientAliasDto, IngredientAliasInputDto } from './ingredient.dto';
import { IngredientAliasService } from './ingredient-alias.service';

/**
 * Les Alias d'ingrédient. Globaux comme le catalogue (`IngredientAlias` est
 * dans `MODELES_HORS_ESPACE`) : un libellé que l'un des Comptes rattache,
 * l'autre ne se le voit plus demander.
 */
@Controller('ingredient-aliases')
export class IngredientAliasController {
  constructor(private readonly alias: IngredientAliasService) {}

  @Post()
  @ZodResponse({ status: 201, type: IngredientAliasDto })
  rattacher(@Body() saisie: IngredientAliasInputDto) {
    return this.alias.rattacher(saisie);
  }
}
