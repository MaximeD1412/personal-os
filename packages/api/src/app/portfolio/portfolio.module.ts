import { Module } from '@nestjs/common';
import { PresentationController } from './presentation.controller';
import { PresentationRepository } from './presentation.repository';
import { PresentationService } from './presentation.service';

/**
 * Ce qui part vers le portfolio public. Pour l'instant, les Présentations
 * publiques des Projets et leur État de publication ; le portfolio lui-même
 * les lira (PORTFOLIO-5), sans jamais toucher aux notes privées.
 */
@Module({
  controllers: [PresentationController],
  providers: [PresentationService, PresentationRepository],
})
export class PortfolioModule {}
