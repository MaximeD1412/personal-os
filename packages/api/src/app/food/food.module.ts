import { Module } from '@nestjs/common';
import { IngredientController } from './ingredient.controller';
import { IngredientRepository } from './ingredient.repository';
import { IngredientService } from './ingredient.service';

/**
 * La Cuisine. Elle commence par le catalogue d'Ingrédients, global ; les
 * Recettes, le Planning de repas et les Courses y viendront, dans l'Espace
 * foyer.
 */
@Module({
  controllers: [IngredientController],
  providers: [IngredientService, IngredientRepository],
})
export class FoodModule {}
