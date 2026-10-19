import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';
import {
  IngredientDto,
  IngredientInputDto,
  IngredientListQueryDto,
  IngredientUpdateDto,
} from './ingredient.dto';
import { IngredientService } from './ingredient.service';

/**
 * Le catalogue d'Ingrédients. Il est global, hors Espace (`Ingredient` est
 * dans `MODELES_HORS_ESPACE`) : aucun `@Espaces` à déclarer, les deux Comptes
 * lisent et modifient le même catalogue.
 *
 * Pas de suppression : un Ingrédient en double se fusionne (CUISINE-4), pour
 * que les recettes qui le citent le suivent.
 */
@Controller('ingredients')
export class IngredientController {
  constructor(private readonly ingredients: IngredientService) {}

  @Get()
  @ZodResponse({ status: 200, type: [IngredientDto] })
  lister(@Query() requete: IngredientListQueryDto) {
    return this.ingredients.lister(requete);
  }

  @Get(':id')
  @ZodResponse({ status: 200, type: IngredientDto })
  lire(@Param('id') id: string) {
    return this.ingredients.lire(id);
  }

  @Post()
  @ZodResponse({ status: 201, type: IngredientDto })
  creer(@Body() saisie: IngredientInputDto) {
    return this.ingredients.creer(saisie);
  }

  @Patch(':id')
  @ZodResponse({ status: 200, type: IngredientDto })
  modifier(@Param('id') id: string, @Body() saisie: IngredientUpdateDto) {
    return this.ingredients.modifier(id, saisie);
  }
}
