import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiNoContentResponse } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import type { UserRecord } from '../auth/auth.repository';
import { CurrentUser } from '../auth/current-user.decorator';
import { Espaces } from '../espace/espaces.decorator';
import {
  MealWishDto,
  MealWishInputDto,
  MealWishListQueryDto,
} from './meal-wish.dto';
import { MealWishService } from './meal-wish.service';

/**
 * Les Souhaits du Foyer, par semaine. La Cuisine n'accepte que l'Espace
 * foyer : les deux Comptes lisent et retirent les mêmes Souhaits, et un dépôt
 * ne choisit pas d'Espace, le module le pose (ADR 0030).
 */
@Controller('meal-wishes')
@Espaces('HOUSEHOLD')
export class MealWishController {
  constructor(private readonly souhaits: MealWishService) {}

  @Get()
  @ZodResponse({ status: 200, type: [MealWishDto] })
  lister(@Query() { week }: MealWishListQueryDto) {
    return this.souhaits.lister(week);
  }

  @Post()
  @ZodResponse({ status: 201, type: MealWishDto })
  deposer(@Body() saisie: MealWishInputDto, @CurrentUser() compte: UserRecord) {
    return this.souhaits.deposer(saisie, compte.id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  retirer(@Param('id') id: string): Promise<void> {
    return this.souhaits.retirer(id);
  }
}
