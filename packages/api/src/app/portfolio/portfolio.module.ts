import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { CvController } from './cv.controller';
import { CvService } from './cv.service';
import { PageContentController } from './page-content.controller';
import { PageContentRepository } from './page-content.repository';
import { PageContentService } from './page-content.service';
import { PresentationController } from './presentation.controller';
import { PresentationRepository } from './presentation.repository';
import { PresentationService } from './presentation.service';
import { PublicController } from './public.controller';
import { PublicRepository } from './public.repository';
import { PublicService } from './public.service';

/**
 * Ce qui part vers le portfolio public : les Présentations publiques des
 * Projets et les Pages de contenu, chacune avec son État de publication, et le
 * CV en PDF, rangé dans le stockage objet. Le portfolio public les lit par
 * `/public/…` (`PublicController`), sans jamais toucher aux notes privées.
 */
@Module({
  imports: [StorageModule],
  controllers: [
    PresentationController,
    PageContentController,
    CvController,
    PublicController,
  ],
  providers: [
    PresentationService,
    PresentationRepository,
    PageContentService,
    PageContentRepository,
    CvService,
    PublicService,
    PublicRepository,
  ],
})
export class PortfolioModule {}
