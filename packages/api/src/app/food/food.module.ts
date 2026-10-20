import { Module } from '@nestjs/common';
import { AgendaPortModule } from '../agenda-port/agenda-port.module';
import { FoodPreferenceController } from './food-preference.controller';
import { FoodPreferenceRepository } from './food-preference.repository';
import { FoodPreferenceService } from './food-preference.service';
import { IngredientAliasController } from './ingredient-alias.controller';
import { IngredientAliasRepository } from './ingredient-alias.repository';
import { IngredientAliasService } from './ingredient-alias.service';
import { IngredientController } from './ingredient.controller';
import { IngredientRepository } from './ingredient.repository';
import { IngredientService } from './ingredient.service';
import { MealPlanEntryAgendaContributor } from './meal-plan-entry-agenda.contributor';
import { MealPlanController } from './meal-plan.controller';
import { MealPlanRepository } from './meal-plan.repository';
import { MealPlanService } from './meal-plan.service';
import { MealWishController } from './meal-wish.controller';
import { MealWishRepository } from './meal-wish.repository';
import { MealWishService } from './meal-wish.service';
import { RecipeController } from './recipe.controller';
import { RecipeRepository } from './recipe.repository';
import { RecipeService } from './recipe.service';

/**
 * La Cuisine. Le catalogue d'Ingrédients et ses Alias sont globaux ; les
 * Recettes, les Préférences alimentaires, le Planning de repas et ses Souhaits
 * vivent dans l'Espace foyer, où les Courses les rejoindront. Les Repas planifiés se
 * présentent à l'Agenda (ADR 0011).
 */
@Module({
  imports: [AgendaPortModule],
  controllers: [
    IngredientController,
    IngredientAliasController,
    FoodPreferenceController,
    RecipeController,
    MealPlanController,
    MealWishController,
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
    MealPlanService,
    MealPlanRepository,
    MealWishService,
    MealWishRepository,
    MealPlanEntryAgendaContributor,
  ],
})
export class FoodModule {}
