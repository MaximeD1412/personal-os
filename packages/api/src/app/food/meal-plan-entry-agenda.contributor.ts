import { Injectable, type OnModuleInit } from '@nestjs/common';
import {
  aujourdhui,
  FUSEAU,
  instantDans,
  SOURCE_CUISINE,
  type AgendaContributor,
  type AgendaItem,
  type AgendaPeriod,
  type MealMoment,
} from '@personal-os/contracts';
import { AgendaRegistry } from '../agenda-port/agenda.registry';
import {
  MealPlanRepository,
  type MealPlanEntryRecord,
} from './meal-plan.repository';

/** L'heure à laquelle l'Agenda place chaque moment, heure de Paris. */
const HEURES_DES_MOMENTS: Readonly<
  Record<MealMoment, { heure: number; minute: number }>
> = {
  LUNCH: { heure: 12, minute: 0 },
  DINNER: { heure: 19, minute: 30 },
};

/** L'instant où l'Agenda place un repas : midi, ou 19 h 30, à Paris. */
export function debutDuRepas(jour: string, moment: MealMoment): string {
  const { heure, minute } = HEURES_DES_MOMENTS[moment];

  return instantDans(jour, heure, minute, FUSEAU);
}

/**
 * Les Repas planifiés tels qu'ils se présentent à l'Agenda (ADR 0011). Seuls
 * les repas approuvés y entrent : un repas proposé n'est pas encore décidé,
 * un repas refusé ne sera pas cuisiné.
 *
 * Aucun filtre par Espace n'apparaît : la garde borne les requêtes du dépôt
 * comme partout ailleurs (ADR 0028).
 */
@Injectable()
export class MealPlanEntryAgendaContributor
  implements AgendaContributor, OnModuleInit
{
  readonly source = SOURCE_CUISINE;

  constructor(
    private readonly repository: MealPlanRepository,
    private readonly agenda: AgendaRegistry,
  ) {}

  onModuleInit(): void {
    this.agenda.enregistrer(this);
  }

  async lister({ from, to }: AgendaPeriod): Promise<AgendaItem[]> {
    const repas = await this.repository.approuvesEntre(
      aujourdhui(FUSEAU, new Date(from)),
      aujourdhui(FUSEAU, new Date(to)),
    );
    const debut = Date.parse(from);
    const fin = Date.parse(to);

    return repas.map(enEntree).filter(({ startsAt }) => {
      const instant = Date.parse(startsAt);
      return debut <= instant && instant <= fin;
    });
  }
}

/**
 * Le repas, réduit à une référence : son intitulé est le titre de sa recette,
 * ou son intitulé libre. Ni portions, ni Participants : l'Agenda affiche des
 * références, pas des objets (ADR 0011). Il est prévu jusqu'à ce qu'un Repas
 * cuisiné le réalise (CUISINE-11).
 */
function enEntree(repas: MealPlanEntryRecord): AgendaItem {
  return {
    source: SOURCE_CUISINE,
    sourceId: repas.id,
    title: repas.recipe?.title ?? repas.title ?? '',
    startsAt: debutDuRepas(repas.day, repas.moment),
    endsAt: null,
    status: 'PLANNED',
  };
}
