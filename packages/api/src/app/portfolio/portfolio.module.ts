import { Module } from '@nestjs/common';
import { PageContentController } from './page-content.controller';
import { PageContentRepository } from './page-content.repository';
import { PageContentService } from './page-content.service';
import { PresentationController } from './presentation.controller';
import { PresentationRepository } from './presentation.repository';
import { PresentationService } from './presentation.service';

/**
 * Ce qui part vers le portfolio public : les Présentations publiques des
 * Projets et les Pages de contenu, chacune avec son État de publication. Le
 * portfolio lui-même les lira (PORTFOLIO-5), sans jamais toucher aux notes
 * privées.
 */
@Module({
  controllers: [PresentationController, PageContentController],
  providers: [
    PresentationService,
    PresentationRepository,
    PageContentService,
    PageContentRepository,
  ],
})
export class PortfolioModule {}
