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
import { IngredientAliasService } from './ingredient-alias.service';
import {
  IngredientDto,
  IngredientInputDto,
  IngredientListQueryDto,
  IngredientMergeInputDto,
  IngredientResolutionDto,
  IngredientResolveInputDto,
  IngredientUpdateDto,
} from './ingredient.dto';
import { IngredientService } from './ingredient.service';
import { PreferredProductInputDto } from './product.dto';

/**
 * Le catalogue d'Ingrédients. Il est global, hors Espace (`Ingredient` est
 * dans `MODELES_HORS_ESPACE`) : aucun `@Espaces` à déclarer, les deux Comptes
 * lisent et modifient le même catalogue.
 *
 * Pas de suppression : un Ingrédient en double se fusionne (CUISINE-4), pour
 * que les recettes, le stock, les courses et les Préférences qui le citent le
 * suivent.
 *
 * La résolution ne crée rien, pas même un Alias : elle répond 200.
 */
@Controller('ingredients')
export class IngredientController {
  constructor(
    private readonly ingredients: IngredientService,
    private readonly alias: IngredientAliasService,
  ) {}

  @Get()
  @ZodResponse({ status: 200, type: [IngredientDto] })
  lister(@Query() requete: IngredientListQueryDto) {
    return this.ingredients.lister(requete);
  }

  @Post('resolve')
  @HttpCode(200)
  @ZodResponse({ status: 200, type: [IngredientResolutionDto] })
  resoudre(@Body() { labels }: IngredientResolveInputDto) {
    return this.alias.resoudre(labels);
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

  /** Choisit le Produit préféré, repris dans la liste de courses (CUISINE-12). */
  @Post(':id/preferred-product')
  @HttpCode(200)
  @ZodResponse({ status: 200, type: IngredientDto })
  preferer(
    @Param('id') id: string,
    @Body() { productId }: PreferredProductInputDto,
  ) {
    return this.ingredients.preferer(id, productId);
  }

  /**
   * Fusionne ce doublon dans l'Ingrédient `intoId`, et rend celui-ci
   * (CUISINE-4). Le doublon disparaît : son nom devient un Alias du conservé.
   */
  @Post(':id/merge')
  @HttpCode(200)
  @ZodResponse({ status: 200, type: IngredientDto })
  fusionner(
    @Param('id') id: string,
    @Body() { intoId }: IngredientMergeInputDto,
  ) {
    return this.ingredients.fusionner(id, intoId);
  }
}
