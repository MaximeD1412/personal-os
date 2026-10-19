import Anthropic from '@anthropic-ai/sdk';
import { Module } from '@nestjs/common';
import { AiTraceController } from './ai-trace.controller';
import { AiTraceRepository } from './ai-trace.repository';
import { AiTraceService } from './ai-trace.service';
import { ClaudeGenerateur } from './claude.generateur';
import { FournisseurIA } from './fournisseur-ia';
import { GenerateurIA } from './generateur-ia';
import { GenerateurIAFactice } from './generateur-ia.factice';
import { GenerateurIAService } from './generateur-ia.service';
import { IA_CONFIG, lireIAConfig, type IAConfig } from './ia.config';

/**
 * Le port IA et le journal de ses appels. Un module qui veut un modèle importe
 * celui-ci et reçoit `GenerateurIA` : il ne sait pas quel fournisseur répond,
 * et ne peut pas contourner la trace ni le plafond.
 */
@Module({
  controllers: [AiTraceController],
  providers: [
    { provide: IA_CONFIG, useFactory: () => lireIAConfig() },
    {
      provide: FournisseurIA,
      inject: [IA_CONFIG],
      useFactory: (config: IAConfig): FournisseurIA =>
        config.fournisseur === 'claude'
          ? new ClaudeGenerateur(
              new Anthropic({ apiKey: config.cleApi }),
              config.modele,
            )
          : new GenerateurIAFactice(),
    },
    { provide: GenerateurIA, useClass: GenerateurIAService },
    AiTraceRepository,
    AiTraceService,
  ],
  exports: [GenerateurIA],
})
export class AiModule {}
