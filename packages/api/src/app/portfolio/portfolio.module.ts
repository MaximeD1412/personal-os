import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { CvController } from './cv.controller';
import { CvService } from './cv.service';
import { PresentationController } from './presentation.controller';
import { PresentationRepository } from './presentation.repository';
import { PresentationService } from './presentation.service';

/**
 * Ce qui part vers le portfolio public : le CV en PDF, rangé dans le stockage
 * objet, et les Présentations publiques des Projets avec leur État de
 * publication. Le portfolio lui-même les servira (PORTFOLIO-5), sans jamais
 * toucher aux notes privées.
 */
@Module({
  imports: [StorageModule],
  controllers: [CvController, PresentationController],
  providers: [CvService, PresentationService, PresentationRepository],
})
export class PortfolioModule {}
