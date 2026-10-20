import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Put,
} from '@nestjs/common';
import { ApiNoContentResponse } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { Espaces } from '../espace/espaces.decorator';
import { PantryItemDto, PantryItemInputDto } from './pantry-item.dto';
import { PantryItemService } from './pantry-item.service';

/**
 * Le Stock domestique : la Cuisine est à Espace unique, l'Espace foyer, que le
 * module pose lui-même. Une ligne se désigne par son Ingrédient, puisqu'il
 * n'en a qu'une.
 */
@Controller('pantry-items')
@Espaces('HOUSEHOLD')
export class PantryItemController {
  constructor(private readonly stock: PantryItemService) {}

  @Get()
  @ZodResponse({ status: 200, type: [PantryItemDto] })
  lister() {
    return this.stock.lister();
  }

  /** La correction manuelle : elle remplace la ligne, ou la crée. */
  @Put(':ingredientId')
  @ZodResponse({ status: 200, type: PantryItemDto })
  corriger(
    @Param('ingredientId') ingredientId: string,
    @Body() saisie: PantryItemInputDto,
  ) {
    return this.stock.corriger(ingredientId, saisie);
  }

  @Delete(':ingredientId')
  @HttpCode(204)
  @ApiNoContentResponse()
  supprimer(@Param('ingredientId') ingredientId: string): Promise<void> {
    return this.stock.supprimer(ingredientId);
  }
}
