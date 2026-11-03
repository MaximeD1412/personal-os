import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';
import {
  PageContentDto,
  PageContentInputDto,
  PageContentKeyDto,
} from './page-content.dto';
import { PageContentService } from './page-content.service';

/**
 * Les Pages de contenu du portfolio : trois pages fixes, un texte par langue.
 * Elles sont globales, hors Espace (`PageContent` est dans
 * `MODELES_HORS_ESPACE`) : aucun `@Espaces` à déclarer. L'État de publication
 * ne change que par ses transitions, jamais par la rédaction.
 */
@Controller('page-contents')
export class PageContentController {
  constructor(private readonly pages: PageContentService) {}

  /** Six textes au plus : la liste est bornée par nature. */
  @Get()
  @ZodResponse({ status: 200, type: [PageContentDto] })
  lister() {
    return this.pages.lister();
  }

  /** Crée la page dans cette langue, ou en remplace le texte. */
  @Put(':slug/:lang')
  @ZodResponse({ status: 200, type: PageContentDto })
  rediger(
    @Param() { slug, lang }: PageContentKeyDto,
    @Body() saisie: PageContentInputDto,
  ) {
    return this.pages.rediger(slug, lang, saisie);
  }

  @Post(':slug/:lang/ready')
  @HttpCode(200)
  @ZodResponse({ status: 200, type: PageContentDto })
  marquerPrete(@Param() { slug, lang }: PageContentKeyDto) {
    return this.pages.transition(slug, lang, 'ready');
  }

  @Post(':slug/:lang/publish')
  @HttpCode(200)
  @ZodResponse({ status: 200, type: PageContentDto })
  publier(@Param() { slug, lang }: PageContentKeyDto) {
    return this.pages.transition(slug, lang, 'publish');
  }

  @Post(':slug/:lang/unpublish')
  @HttpCode(200)
  @ZodResponse({ status: 200, type: PageContentDto })
  depublier(@Param() { slug, lang }: PageContentKeyDto) {
    return this.pages.transition(slug, lang, 'unpublish');
  }
}
