import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { CvController } from './cv.controller';
import { CvService } from './cv.service';

/**
 * Ce qui part vers le portfolio public. Pour l'instant, le CV en PDF, rangé
 * dans le stockage objet ; le portfolio lui-même le servira (PORTFOLIO-5).
 */
@Module({
  imports: [StorageModule],
  controllers: [CvController],
  providers: [CvService],
})
export class PortfolioModule {}
