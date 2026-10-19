import { Body, Controller, Module, Post } from '@nestjs/common';
import { EventInputDto } from '../src/app/calendar/event.dto';
import { EventRepository } from '../src/app/calendar/event.repository';
import { EventService } from '../src/app/calendar/event.service';
import { Espaces } from '../src/app/espace/espaces.decorator';

/**
 * Un module qui n'accepte que l'Espace foyer — comme le feront les repas, les
 * courses et le stock (ADR 0014). Il n'existe que dans la campagne de test :
 * le refus qu'on vérifie ici est celui du **mécanisme**, et le vérifier sur un
 * endpoint de production n'en dirait pas davantage (ADR 0016).
 */
@Controller('foyer-seul')
@Espaces('HOUSEHOLD')
export class ControleurFoyerSeul {
  constructor(private readonly evenements: EventService) {}

  @Post()
  creer(@Body() saisie: EventInputDto) {
    return this.evenements.creer(saisie);
  }
}

/** Un module qui touche à des données cloisonnées sans rien déclarer. */
@Controller('sans-declaration')
export class ControleurSansDeclaration {
  constructor(private readonly evenements: EventService) {}

  @Post()
  creer(@Body() saisie: EventInputDto) {
    return this.evenements.creer(saisie);
  }
}

@Module({
  controllers: [ControleurFoyerSeul, ControleurSansDeclaration],
  providers: [EventService, EventRepository],
})
export class ModuleRestreint {}
