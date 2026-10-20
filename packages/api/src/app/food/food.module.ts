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

/**
 * La Cuisine. Elle commence par le catalogue d'Ingrédients et ses Alias,
 * globaux, et les Préférences alimentaires du Foyer ; les Recettes, le
 * Planning de repas et les Courses y viendront, dans l'Espace foyer.
 */
@Module({
  controllers: [
    IngredientController,
    IngredientAliasController,
    FoodPreferenceController,
  ],
  providers: [
    IngredientService,
    IngredientRepository,
    IngredientAliasService,
    IngredientAliasRepository,
    FoodPreferenceService,
    FoodPreferenceRepository,
  ],
})
export class FoodModule {}
