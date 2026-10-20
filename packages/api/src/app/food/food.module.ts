import { Module } from '@nestjs/common';
import { FoodPreferenceController } from './food-preference.controller';
import { FoodPreferenceRepository } from './food-preference.repository';
import { FoodPreferenceService } from './food-preference.service';
import { IngredientAliasController } from './ingredient-alias.controller';
import { IngredientAliasRepository } from './ingredient-alias.repository';
import { IngredientAliasService } from './ingredient-alias.service';
import { IngredientController } from './ingredient.controller';
import { IngredientRepository } from './ingredient.repository';
import { IngredientService } from './ingredient.service';
import { PantryItemController } from './pantry-item.controller';
import { PantryItemRepository } from './pantry-item.repository';
import { PantryItemService } from './pantry-item.service';
import { RecipeController } from './recipe.controller';
import { RecipeRepository } from './recipe.repository';
import { RecipeService } from './recipe.service';

/**
 * La Cuisine. Le catalogue d'Ingrédients et ses Alias sont globaux ; les
 * Recettes, les Préférences alimentaires et le Stock domestique vivent dans
 * l'Espace foyer, où le Planning de repas et les Courses les rejoindront.
 */
@Module({
  controllers: [
    IngredientController,
    IngredientAliasController,
    FoodPreferenceController,
    RecipeController,
    PantryItemController,
  ],
  providers: [
    IngredientService,
    IngredientRepository,
    IngredientAliasService,
    IngredientAliasRepository,
    FoodPreferenceService,
    FoodPreferenceRepository,
    RecipeService,
    RecipeRepository,
    PantryItemService,
    PantryItemRepository,
  ],
})
export class FoodModule {}
