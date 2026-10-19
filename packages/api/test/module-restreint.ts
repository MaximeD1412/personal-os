import { Body, Controller, Module, Post } from '@nestjs/common';
import { EventInputDto } from '../src/app/calendar/event.dto';
import { EventRepository } from '../src/app/calendar/event.repository';
import { EventService } from '../src/app/calendar/event.service';
import { Espaces } from '../src/app/espace/espaces.decorator';
import { PrismaService } from '@personal-os/database';

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

/**
 * Un module qui rattache une exception à son Événement par un geste imbriqué,
 * au lieu de l'écrire par le dépôt du modèle concerné (ADR 0028).
 */
@Controller('rattachement-imbrique')
@Espaces('PERSONAL', 'HOUSEHOLD')
export class ControleurRattachementImbrique {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async rattacher(@Body() saisie: { scopeId: string }): Promise<void> {
    await this.prisma.event.create({
      data: {
        title: 'Réunion',
        startsAt: new Date(),
        category: 'OTHER',
        scopeId: saisie.scopeId,
        exceptions: { connect: { id: 'exception-quelconque' } },
      },
    });
  }
}

@Module({
  controllers: [
    ControleurFoyerSeul,
    ControleurSansDeclaration,
    ControleurRattachementImbrique,
  ],
  providers: [EventService, EventRepository],
})
export class ModuleRestreint {}
