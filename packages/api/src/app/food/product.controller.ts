import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiNoContentResponse } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { ProductDto, ProductInputDto, ProductUpdateDto } from './product.dto';
import { ProductService } from './product.service';

/**
 * Les Produits (CUISINE-12). Ils sont globaux, hors Espace (`Product` est
 * dans `MODELES_HORS_ESPACE`) comme le catalogue d'Ingrédients : aucun
 * `@Espaces` à déclarer. Le choix du Produit préféré est une action sur
 * l'Ingrédient (`POST /ingredients/:id/preferred-product`).
 */
@Controller()
export class ProductController {
  constructor(private readonly produits: ProductService) {}

  @Get('ingredients/:id/products')
  @ZodResponse({ status: 200, type: [ProductDto] })
  lister(@Param('id') ingredientId: string) {
    return this.produits.lister(ingredientId);
  }

  @Post('products')
  @ZodResponse({ status: 201, type: ProductDto })
  creer(@Body() saisie: ProductInputDto) {
    return this.produits.creer(saisie);
  }

  @Patch('products/:id')
  @ZodResponse({ status: 200, type: ProductDto })
  modifier(@Param('id') id: string, @Body() saisie: ProductUpdateDto) {
    return this.produits.modifier(id, saisie);
  }

  @Delete('products/:id')
  @HttpCode(204)
  @ApiNoContentResponse()
  supprimer(@Param('id') id: string): Promise<void> {
    return this.produits.supprimer(id);
  }
}
