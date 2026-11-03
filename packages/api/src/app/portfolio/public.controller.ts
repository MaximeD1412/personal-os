import {
  Controller,
  Get,
  Head,
  Param,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiOkResponse, ApiProduces } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { LecturePublique } from '../espace/lecture-publique.decorator';
import { CvService } from './cv.service';
import {
  PublicLangKeyDto,
  PublicPageDto,
  PublicPageKeyDto,
  PublicProjectDto,
  PublicProjectKeyDto,
  PublicProjectSummaryDto,
} from './public.dto';
import { PublicService } from './public.service';

/**
 * Le portfolio public, sans session (ADR 0026) et sous la portée de lecture
 * publique : seuls les contenus publiés, dans la langue demandée, sans repli
 * (ADR 0019). Chaque route a son schéma de sortie dédié (SEC-2).
 */
@Controller('public')
@LecturePublique()
export class PublicController {
  constructor(
    private readonly portfolio: PublicService,
    private readonly cvs: CvService,
  ) {}

  /** Les Projets publiés dans cette langue : un catalogue, lu en entier (ADR 0030). */
  @Get(':lang/projects')
  @ZodResponse({ status: 200, type: [PublicProjectSummaryDto] })
  projets(@Param() { lang }: PublicLangKeyDto) {
    return this.portfolio.projets(lang);
  }

  @Get(':lang/projects/:id')
  @ZodResponse({ status: 200, type: PublicProjectDto })
  projet(@Param() { lang, id }: PublicProjectKeyDto) {
    return this.portfolio.projet(id, lang);
  }

  @Get(':lang/pages/:slug')
  @ZodResponse({ status: 200, type: PublicPageDto })
  page(@Param() { lang, slug }: PublicPageKeyDto) {
    return this.portfolio.page(slug, lang);
  }

  /**
   * La présence du CV, que le portfolio demande à chaque visite. Sans ce
   * gestionnaire, Express servirait le HEAD par la route GET, qui télécharge
   * le PDF entier depuis le stockage. Il doit donc être déclaré avant elle.
   */
  @Head('cv/:lang')
  @ApiProduces('application/pdf')
  @ApiOkResponse({ description: 'Le CV existe pour cette langue.' })
  async presenceDuCv(
    @Param() { lang }: PublicLangKeyDto,
    @Res({ passthrough: true }) reponse: Response,
  ): Promise<void> {
    const { taille } = await this.cvs.decrire(lang);
    reponse.setHeader('Content-Type', 'application/pdf');
    reponse.setHeader('Content-Length', taille);
  }

  /** Le PDF de cette langue, tel qu'il a été téléversé ; aucun repli. */
  @Get('cv/:lang')
  @ApiProduces('application/pdf')
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  async cv(@Param() { lang }: PublicLangKeyDto): Promise<StreamableFile> {
    const objet = await this.cvs.lire(lang);
    return new StreamableFile(objet.contenu, {
      type: 'application/pdf',
      length: objet.taille,
      disposition: `attachment; filename="cv-${lang.toLowerCase()}.pdf"`,
    });
  }
}
