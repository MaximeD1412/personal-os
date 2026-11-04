import { Body, Controller, Module, Post } from '@nestjs/common';
import { z } from 'zod';
import { AiModule } from '../src/app/ai/ai.module';
import { GenerateurIA } from '../src/app/ai/generateur-ia';
import { Espaces } from '../src/app/espace/espaces.decorator';

/** La forme que la route d'essai demande au modèle. */
export const UN_PLAT = z.object({ plat: z.string() });

/**
 * Un module qui appelle le port IA, comme le feront la génération du planning
 * et la barre de commande. Il n'existe que dans la campagne de test : aucune
 * route de production n'appelle encore le modèle (CUISINE-16, CMD-2).
 */
@Controller('essai-ia')
@Espaces('HOUSEHOLD')
export class ControleurEssaiIA {
  constructor(private readonly generateur: GenerateurIA) {}

  @Post()
  generer(@Body() saisie: { but: string; message: string }) {
    return this.generateur.genererStructure({
      but: saisie.but,
      systeme: 'Tu proposes un plat.',
      message: saisie.message,
      schema: UN_PLAT,
      maxTokens: 500,
    });
  }
}

@Module({
  imports: [AiModule],
  controllers: [ControleurEssaiIA],
})
export class ModuleEssaiIA {}
