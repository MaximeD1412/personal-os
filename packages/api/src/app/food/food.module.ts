import { Module } from '@nestjs/common';
import { IngredientAliasController } from './ingredient-alias.controller';
import { IngredientAliasRepository } from './ingredient-alias.repository';
import { IngredientAliasService } from './ingredient-alias.service';
import { IngredientController } from './ingredient.controller';
import { IngredientRepository } from './ingredient.repository';
import { IngredientService } from './ingredient.service';

/**
 * La Cuisine. Elle commence par le catalogue d'Ingrédients et ses Alias,
 * globaux ; les Recettes, le Planning de repas et les Courses y viendront,
 * dans l'Espace foyer.
 */
@Module({
  controllers: [IngredientController, IngredientAliasController],
  providers: [
    IngredientService,
    IngredientRepository,
    IngredientAliasService,
    IngredientAliasRepository,
  ],
})
export class FoodModule {}
