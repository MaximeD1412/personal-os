import {
  Controller,
  Get,
  Param,
  Put,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiProduces,
} from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { CvDto, CvKeyDto } from './cv.dto';
import { CvService } from './cv.service';
import {
  CHAMP_DU_FICHIER,
  FichierRequis,
  TeleversementDuCv,
} from './cv.televersement';

/**
 * Le CV du portfolio, téléversé en PDF, un par langue. Ces routes sont
 * privées : le portfolio public le servira par sa propre route (PORTFOLIO-5).
 * Le CV n'appartient à aucun Espace, et ne touche à aucune donnée cloisonnée.
 */
@Controller('cv')
export class CvController {
  constructor(private readonly cvs: CvService) {}

  /** Au plus un CV par langue : la liste est bornée par nature (ADR 0030). */
  @Get()
  @ZodResponse({ status: 200, type: [CvDto] })
  lister() {
    return this.cvs.lister();
  }

  @Put(':lang')
  @UseInterceptors(TeleversementDuCv)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: [CHAMP_DU_FICHIER],
      properties: { [CHAMP_DU_FICHIER]: { type: 'string', format: 'binary' } },
    },
  })
  @ZodResponse({ status: 200, type: CvDto })
  televerser(
    @Param() { lang }: CvKeyDto,
    @UploadedFile(FichierRequis) fichier: Express.Multer.File,
  ) {
    return this.cvs.televerser(lang, fichier.buffer);
  }

  /** Le PDF tel qu'il a été téléversé : un binaire, sans schéma de sortie. */
  @Get(':lang')
  @ApiProduces('application/pdf')
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  async telecharger(@Param() { lang }: CvKeyDto): Promise<StreamableFile> {
    const objet = await this.cvs.lire(lang);
    return new StreamableFile(objet.contenu, {
      type: 'application/pdf',
      length: objet.taille,
      disposition: `attachment; filename="cv-${lang.toLowerCase()}.pdf"`,
    });
  }
}
