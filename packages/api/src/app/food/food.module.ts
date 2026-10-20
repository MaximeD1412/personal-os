import { Module } from '@nestjs/common';
import { IngredientAliasController } from './ingredient-alias.controller';
import { IngredientAliasRepository } from './ingredient-alias.repository';
import { IngredientAliasService } from './ingredient-alias.service';
import { IngredientController } from './ingredient.controller';
import { IngredientRepository } from './ingredient.repository';
import { IngredientService } from './ingredient.service';
import { RecipeController } from './recipe.controller';
import { RecipeRepository } from './recipe.repository';
import { RecipeService } from './recipe.service';

/**
 * La Cuisine. Le catalogue d'Ingrédients et ses Alias sont globaux ; les
 * Recettes vivent dans l'Espace foyer, où le Planning de repas et les Courses
 * les rejoindront.
 */
@Module({
  controllers: [
    IngredientController,
    IngredientAliasController,
    RecipeController,
  ],
  providers: [
    IngredientService,
    IngredientRepository,
    IngredientAliasService,
    IngredientAliasRepository,
    RecipeService,
    RecipeRepository,
  ],
})
export class FoodModule {}
