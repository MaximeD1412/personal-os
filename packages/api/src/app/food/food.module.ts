import { Module } from '@nestjs/common';
import { AgendaPortModule } from '../agenda-port/agenda-port.module';
import { AiModule } from '../ai/ai.module';
import { CookedMealController } from './cooked-meal.controller';
import { CookedMealRepository } from './cooked-meal.repository';
import { CookedMealService } from './cooked-meal.service';
import { FoodPreferenceController } from './food-preference.controller';
import { FoodPreferenceRepository } from './food-preference.repository';
import { FoodPreferenceService } from './food-preference.service';
import { GenerationRoundController } from './generation-round.controller';
import { GenerationRoundRepository } from './generation-round.repository';
import { GenerationRoundService } from './generation-round.service';
import { IngredientAliasController } from './ingredient-alias.controller';
import { IngredientAliasRepository } from './ingredient-alias.repository';
import { IngredientAliasService } from './ingredient-alias.service';
import { IngredientController } from './ingredient.controller';
import { IngredientRepository } from './ingredient.repository';
import { IngredientService } from './ingredient.service';
import { MealPlanEntryAgendaContributor } from './meal-plan-entry-agenda.contributor';
import { MealPlanEntryController } from './meal-plan-entry.controller';
import { MealPlanController } from './meal-plan.controller';
import { MealPlanRepository } from './meal-plan.repository';
import { MealPlanService } from './meal-plan.service';
import { MealWishController } from './meal-wish.controller';
import { MealWishRepository } from './meal-wish.repository';
import { MealWishService } from './meal-wish.service';
import { PantryItemController } from './pantry-item.controller';
import { PantryItemRepository } from './pantry-item.repository';
import { PantryItemService } from './pantry-item.service';
import { RecipeController } from './recipe.controller';
import { RecipeRepository } from './recipe.repository';
import { RecipeService } from './recipe.service';

/**
 * La Cuisine. Le catalogue d'Ingrédients et ses Alias sont globaux ; les
 * Recettes, les Préférences alimentaires, le Stock domestique, le Planning de
 * repas, ses Souhaits et ses Repas cuisinés vivent dans l'Espace foyer, où les
 * Courses les rejoindront. Les Repas planifiés se présentent à l'Agenda
 * (ADR 0011) ; les Tours de génération passent par le port IA.
 */
@Module({
  imports: [AgendaPortModule, AiModule],
  controllers: [
    IngredientController,
    IngredientAliasController,
    FoodPreferenceController,
    RecipeController,
    MealPlanController,
    MealPlanEntryController,
    GenerationRoundController,
    MealWishController,
    PantryItemController,
    CookedMealController,
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
    GenerationRoundService,
    GenerationRoundRepository,
    MealWishService,
    MealWishRepository,
    MealPlanEntryAgendaContributor,
    PantryItemService,
    PantryItemRepository,
    CookedMealService,
    CookedMealRepository,
  ],
})
export class FoodModule {}
