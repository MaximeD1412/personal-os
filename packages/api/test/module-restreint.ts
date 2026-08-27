import { Body, Controller, Module, Post } from '@nestjs/common';
import { Espaces } from '../src/app/espace/espaces.decorator';
import { TraceService } from '../src/app/traces/trace.service';
import { TraceRepository } from '../src/app/traces/trace.repository';
import type { Trace, TraceInput } from '@personal-os/contracts';

/**
 * Un module qui n'accepte que l'Espace foyer — comme le feront les repas, les
 * courses et le stock (ADR 0014). Il n'existe que dans la campagne de test :
 * le refus qu'on vérifie ici est celui du **mécanisme**, et le vérifier sur un
 * endpoint de production n'en dirait pas davantage (ADR 0016).
 */
@Controller('foyer-seul')
@Espaces('HOUSEHOLD')
export class ControleurFoyerSeul {
  constructor(private readonly traces: TraceService) {}

  @Post()
  creer(@Body() saisie: Partial<TraceInput>): Promise<Trace> {
    return this.traces.creer(saisie);
  }
}

/** Un module qui touche à des données cloisonnées sans rien déclarer. */
@Controller('sans-declaration')
export class ControleurSansDeclaration {
  constructor(private readonly traces: TraceService) {}

  @Post()
  creer(@Body() saisie: Partial<TraceInput>): Promise<Trace> {
    return this.traces.creer(saisie);
  }
}

@Module({
  controllers: [ControleurFoyerSeul, ControleurSansDeclaration],
  providers: [TraceService, TraceRepository],
})
export class ModuleRestreint {}
