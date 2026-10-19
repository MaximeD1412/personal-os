import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { CATALOGUE_DE_COMMANDES, catalogueGenere } from './catalogue/catalogue';
import { CommandBarController } from './command-bar.controller';
import { CommandBarService } from './command-bar.service';
import { UnresolvedCommandRepository } from './unresolved-command.repository';

/**
 * La barre de commande : elle traduit une phrase en formulaire prérempli par
 * le port IA, sans jamais connaître une route d'écriture (ADR 0018).
 */
@Module({
  imports: [AiModule],
  controllers: [CommandBarController],
  providers: [
    { provide: CATALOGUE_DE_COMMANDES, useFactory: catalogueGenere },
    CommandBarService,
    UnresolvedCommandRepository,
  ],
})
export class CommandBarModule {}
