import { Body, Controller, Post } from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';
import { Espaces } from '../espace/espaces.decorator';
import { CookedMealDto, CookedMealInputDto } from './cooked-meal.dto';
import { CookedMealService } from './cooked-meal.service';

/**
 * Les Repas cuisinés du Foyer : la Cuisine est à Espace unique, l'Espace
 * foyer, que le module pose lui-même. Un Repas cuisiné se déclare, il ne se
 * modifie ni ne se supprime : une erreur se corrige dans l'écran de stock.
 */
@Controller('cooked-meals')
@Espaces('HOUSEHOLD')
export class CookedMealController {
  constructor(private readonly repas: CookedMealService) {}

  /** Le manque éventuel revient dans la réponse : il ne bloque jamais. */
  @Post()
  @ZodResponse({ status: 201, type: CookedMealDto })
  declarer(@Body() saisie: CookedMealInputDto) {
    return this.repas.declarer(saisie);
  }
}
