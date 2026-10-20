import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectRepository } from './project.repository';
import { ProjectService } from './project.service';

/**
 * Les Projets de l'Espace personnel : notes, liens et dépenses. La
 * Présentation publique d'un Projet (PORTFOLIO-2) viendra s'y adosser, sans
 * jamais en reprendre les notes.
 */
@Module({
  controllers: [ProjectController],
  providers: [ProjectService, ProjectRepository],
})
export class ProjectsModule {}
