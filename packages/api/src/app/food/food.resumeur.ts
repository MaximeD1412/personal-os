import { Injectable, type OnModuleInit } from '@nestjs/common';
import {
  aujourdhui,
  FUSEAU,
  lundiDe,
  SOURCE_CUISINE,
  type ModuleSummary,
  type ResumeurDeModule,
  type Signal,
} from '@personal-os/contracts';
import { SummaryRegistry } from '../dashboard-port/summary.registry';
import { MealPlanRepository } from './meal-plan.repository';
import {
  PantryItemRepository,
  type PantryItemRecord,
} from './pantry-item.repository';
import {
  ShoppingListRepository,
  type ShoppingListRecord,
} from './shopping-list.repository';

/** Combien de jours avant sa péremption un ingrédient se signale. */
const JOURS_AVANT_PEREMPTION = 3;

const JOUR_ET_MOIS = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  // Un jour civil se lit à minuit UTC : aucun fuseau ne doit le décaler.
  timeZone: 'UTC',
});

/**
 * La Cuisine telle qu'elle se résume au tableau de bord (ADR 0011) : le
 * planning de la semaine qui attend des décisions, les listes de courses
 * encore ouvertes et ce qu'il y reste à acheter, le stock qui périme.
 *
 * Elle pointe vers le registre, jamais l'inverse. Aucun filtre par Espace
 * n'apparaît : la garde borne les requêtes des dépôts à l'Espace foyer, seul
 * qui porte la Cuisine (ADR 0028).
 */
@Injectable()
export class FoodResumeur implements ResumeurDeModule, OnModuleInit {
  readonly module = SOURCE_CUISINE;

  constructor(
    private readonly plannings: MealPlanRepository,
    private readonly listes: ShoppingListRepository,
    private readonly stock: PantryItemRepository,
    private readonly registre: SummaryRegistry,
  ) {}

  onModuleInit(): void {
    this.registre.enregistrer(this);
  }

  async resumer(maintenant: Date): Promise<ModuleSummary> {
    const jour = aujourdhui(FUSEAU, maintenant);
    const semaine = lundiDe(jour);
    const [planning, ouvertes, perimant] = await Promise.all([
      this.plannings.proposesDeLaSemaine(semaine),
      this.listes.lister('OPEN'),
      this.stock.perimantAuPlusTard(plusJours(jour, JOURS_AVANT_PEREMPTION)),
    ]);

    return {
      module: SOURCE_CUISINE,
      indicators: [
        {
          key: 'shopping_list_remaining_items',
          label: 'Articles restants',
          value: ouvertes.reduce((total, liste) => total + restants(liste), 0),
        },
      ],
      signals: [
        ...(planning && planning.jours.length > 0
          ? [decisionsAttendues(planning.id, semaine, planning.jours)]
          : []),
        ...ouvertes.map(listeEnCours),
        ...perimant.map((ligne) => peremption(ligne, jour)),
      ],
    };
  }
}

/**
 * Les repas proposés attendent qu'on les approuve ou les refuse ; le plus
 * proche dit pour quand.
 */
function decisionsAttendues(
  planId: string,
  semaine: string,
  jours: readonly string[],
): Signal {
  const nombre = jours.length;

  return {
    kind: 'food.meal_plan_pending_decisions',
    ref: planId,
    label:
      nombre === 1
        ? '1 repas attend une décision'
        : `${nombre} repas attendent une décision`,
    dueOn: jours[0],
    link: `/repas/planning?semaine=${semaine}`,
  };
}

function listeEnCours(liste: ShoppingListRecord): Signal {
  const nombre = restants(liste);

  return {
    kind: 'food.shopping_list_open',
    ref: liste.id,
    label: `Liste de courses en cours : ${nombre} ${nombre === 1 ? 'article restant' : 'articles restants'}`,
    link: `/courses/${liste.id}`,
  };
}

/**
 * Un ingrédient se désigne par lui-même dans le stock : il n'y a qu'une ligne
 * par Ingrédient, et c'est par lui que l'écran du stock la corrige.
 */
function peremption(ligne: PantryItemRecord, aujourdhui: string): Signal {
  // `expiresOn` n'est jamais vide ici : le dépôt ne rend que les lignes datées.
  const jour = (ligne.expiresOn as Date).toISOString().slice(0, 10);
  const nom = ligne.ingredient.displayName;
  const date = JOUR_ET_MOIS.format(new Date(`${jour}T00:00:00Z`));

  return {
    kind: 'food.pantry_item_expiring',
    ref: ligne.ingredient.id,
    label:
      jour < aujourdhui
        ? `${nom} a périmé le ${date}`
        : `${nom} périme le ${date}`,
    dueOn: jour,
    link: '/repas/stock',
  };
}

function restants(liste: ShoppingListRecord): number {
  return liste.items.filter(({ checked }) => !checked).length;
}

/** Un jour civil décalé de quelques jours, calculé à minuit UTC. */
function plusJours(jour: string, jours: number): string {
  const date = new Date(`${jour}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + jours);

  return date.toISOString().slice(0, 10);
}
