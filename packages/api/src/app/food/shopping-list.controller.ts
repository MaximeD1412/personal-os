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
import { Espaces } from '../espace/espaces.decorator';
import {
  ShoppingListClosureDto,
  ShoppingGapDto,
  ShoppingListDto,
  ShoppingListItemDto,
  ShoppingListItemInputDto,
  ShoppingListProductionQueryDto,
  ShoppingListQueryDto,
} from './shopping-list.dto';
import { ShoppingListService } from './shopping-list.service';

/**
 * Les Listes de courses du Foyer. La Cuisine n'accepte que l'Espace foyer,
 * qu'elle pose elle-même (ADR 0030). Une liste est figée à sa production
 * (ADR 0012) : on y coche, on y ajoute à la main, rien ne la recalcule.
 */
@Controller('shopping-lists')
@Espaces('HOUSEHOLD')
export class ShoppingListController {
  constructor(private readonly listes: ShoppingListService) {}

  @Get()
  @ZodResponse({ status: 200, type: [ShoppingListDto] })
  lister(@Query() requete: ShoppingListQueryDto) {
    return this.listes.lister(requete);
  }

  @Get(':id')
  @ZodResponse({ status: 200, type: ShoppingListDto })
  lire(@Param('id') id: string) {
    return this.listes.lire(id);
  }

  @Post(':id/items')
  @ZodResponse({ status: 201, type: ShoppingListItemDto })
  ajouter(@Param('id') id: string, @Body() saisie: ShoppingListItemInputDto) {
    return this.listes.ajouter(id, saisie);
  }

  @Post(':id/items/:itemId/check')
  @HttpCode(200)
  @ZodResponse({ status: 200, type: ShoppingListItemDto })
  cocher(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.listes.cocher(id, itemId, true);
  }

  @Post(':id/items/:itemId/uncheck')
  @HttpCode(200)
  @ZodResponse({ status: 200, type: ShoppingListItemDto })
  decocher(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.listes.cocher(id, itemId, false);
  }

  /**
   * La clôture : les articles cochés montent le Stock domestique de leur
   * quantité achetée, et la liste ne se modifie plus.
   */
  @Post(':id/close')
  @HttpCode(200)
  @ZodResponse({ status: 200, type: ShoppingListDto })
  cloturer(@Param('id') id: string, @Body() saisie: ShoppingListClosureDto) {
    return this.listes.cloturer(id, saisie);
  }

  /** Seul un ajout manuel se retire. */
  @Delete(':id/items/:itemId')
  @HttpCode(204)
  @ApiNoContentResponse()
  supprimer(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ): Promise<void> {
    return this.listes.supprimer(id, itemId);
  }
}

/**
 * Produire une liste crée un objet du domaine depuis un planning : un `POST`
 * sur sa collection imbriquée (ADR 0030). `?complement=true` n'y met que
 * l'écart avec les listes déjà produites.
 */
@Controller('meal-plans/:id/shopping-lists')
@Espaces('HOUSEHOLD')
export class MealPlanShoppingListController {
  constructor(private readonly listes: ShoppingListService) {}

  @Post()
  @ZodResponse({ status: 201, type: ShoppingListDto })
  produire(
    @Param('id') id: string,
    @Query() requete: ShoppingListProductionQueryDto,
  ) {
    return this.listes.produire(id, requete);
  }
}

/**
 * L'écart entre un planning et ses listes figées : une lecture, recalculée à
 * chaque fois, qui ne touche jamais une liste (ADR 0012).
 */
@Controller('meal-plans/:id/shopping-gap')
@Espaces('HOUSEHOLD')
export class MealPlanShoppingGapController {
  constructor(private readonly listes: ShoppingListService) {}

  @Get()
  @ZodResponse({ status: 200, type: ShoppingGapDto })
  lire(@Param('id') id: string) {
    return this.listes.lireLEcart(id);
  }
}
