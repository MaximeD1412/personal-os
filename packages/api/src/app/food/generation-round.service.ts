import { Injectable } from '@nestjs/common';
import {
  aujourdhui,
  type GenerationRound,
  type GenerationRoundInput,
} from '@personal-os/contracts';
import { GenerateurIA } from '../ai/generateur-ia';
import { ErreurMetier, Introuvable } from '../erreurs/erreur-metier';
import { FoodPreferenceRepository } from './food-preference.repository';
import {
  GenerationRoundRepository,
  type CatalogueDuTour,
  type LecturesDuTour,
} from './generation-round.repository';
import {
  controler,
  type ContexteDuControle,
  type RecetteDuControle,
  type Retenue,
} from './generation/controler';
import {
  construireLaDemande,
  type RepasDeLaDemande,
} from './generation/demande';
import { BUT_GENERATION, zSortieDeGeneration } from './generation/proposition';
import {
  creneauxDuTour,
  peutLancerUnTour,
  type Creneau,
  type PlanningDuTour,
} from './generation/tours';
import {
  MealPlanRepository,
  type MealPlanEntryRecord,
  type MealPlanRecord,
} from './meal-plan.repository';
import { exposerLeRepas, exposerLeTour } from './meal-plan.service';
import { MealWishRepository } from './meal-wish.repository';
import { PantryItemRepository } from './pantry-item.repository';
import { estDansLaSemaine } from './planning/semaine';
import { RecipeRepository } from './recipe.repository';

/**
 * Le plafond de jetons d'une réponse : quatorze repas, chacun une recette
 * nouvelle au besoin, avec ses étapes et ses ingrédients.
 */
const JETONS_D_UN_TOUR = 16_000;

/** Les repas approuvés de ces jours avant la semaine, pour que l'IA varie. */
const JOURS_POUR_VARIER = 14;

/**
 * Un Tour de génération : la demande au modèle, puis le contrôle déterministe
 * de chaque proposition (`generation/controler.ts`), hors du modèle. Seul ce
 * qui passe le contrôle devient un repas proposé. Rien ne s'écrit avant la
 * réponse du modèle : un appel qui échoue ne laisse aucun tour.
 *
 * L'appel au modèle dure : le contrôle relit, à sa réponse, les Recettes, les
 * Ingrédients et les Préférences, et l'écriture n'a lieu que si ni eux ni le
 * planning n'ont changé depuis leur lecture (`LecturesDuTour`).
 */
@Injectable()
export class GenerationRoundService {
  constructor(
    private readonly tours: GenerationRoundRepository,
    private readonly plannings: MealPlanRepository,
    private readonly preferences: FoodPreferenceRepository,
    private readonly souhaits: MealWishRepository,
    private readonly stock: PantryItemRepository,
    private readonly recettes: RecipeRepository,
    private readonly generateur: GenerateurIA,
  ) {}

  /**
   * Le premier tour remplit les créneaux demandés ; les suivants ne portent
   * que sur les repas refusés et les créneaux que le contrôle a vidés, et une
   * demande n'y ajoute rien.
   */
  async lancer(
    planId: string,
    saisie: GenerationRoundInput,
    compteId: string,
  ): Promise<GenerationRound> {
    const planning = await this.planning(planId);
    const etat = enPlanningDuTour(planning);
    const demandes = saisie.slots.map((creneau) => ({
      ...creneau,
      participantIds: unique(creneau.participantIds),
    }));

    if (!peutLancerUnTour(etat, demandes)) {
      throw tourImpossible(etat);
    }
    if (etat.toursLances === 0) {
      await this.verifierLesCreneaux(planning, demandes, compteId);
    }

    const creneaux = creneauxDuTour(etat, demandes);
    const [donnees, souhaits, stock, approuvesAvant] = await Promise.all([
      this.donneesDuControle([]),
      this.souhaits.lister(planning.week),
      this.stock.lister(),
      this.plannings.approuvesEntre(
        decaler(planning.week, -JOURS_POUR_VARIER),
        decaler(planning.week, -1),
      ),
    ]);
    const { catalogue, preferences, recettes } = donnees;

    const demande = construireLaDemande({
      semaine: planning.week,
      aujourdhui: aujourdhui(),
      creneaux,
      preferences,
      ingredients: catalogue.ingredients,
      souhaits,
      stock: stock.map(({ ingredient, quantity, expiresOn }) => ({
        ingredient,
        quantity: quantity.toNumber(),
        expiresOn: expiresOn ? expiresOn.toISOString().slice(0, 10) : null,
      })),
      recettes,
      repas: planning.entries.map(enRepasDeLaDemande),
      approuvesAvant: approuvesAvant.map(enRepasDeLaDemande),
    });

    const { valeur, traceId } = await this.generateur.genererStructure({
      but: BUT_GENERATION,
      systeme: demande.systeme,
      message: demande.message,
      schema: zSortieDeGeneration,
      maxTokens: JETONS_D_UN_TOUR,
    });

    // Ce qui a changé pendant l'appel compte : le contrôle relit tout.
    const aJour = await this.donneesDuControle(
      unique(creneaux.flatMap(({ participantIds }) => participantIds)),
    );
    const { retenues, rejetes } = controler(
      valeur.propositions,
      creneaux,
      aJour,
    );

    const tour = await this.ecrire(
      this.tours.enregistrer(planId, {
        number: etat.toursLances + 1,
        traceId,
        rejected: rejetes,
        lectures: lecturesDuTour(planning, retenues, aJour),
        repas: retenues.map(({ creneau, recette }) => ({
          day: creneau.day,
          moment: creneau.moment,
          participantIds: creneau.participantIds,
          guestCount: creneau.guestCount,
          recette,
        })),
      }),
      planId,
    );

    return {
      ...exposerLeTour(tour),
      entries: tour.entries.map(exposerLeRepas),
    };
  }

  /**
   * Ce que le contrôle confronte, avec la version de chaque donnée. Celle des
   * Préférences de ces Comptes se lit d'abord : une Préférence ajoutée
   * pendant la lecture fait échouer l'écriture, au lieu de passer inaperçue.
   */
  private async donneesDuControle(
    comptes: readonly string[],
  ): Promise<DonneesDuControle> {
    const versions = await this.tours.versionsDesPreferences(comptes);
    const [catalogue, preferences, recettes] = await Promise.all([
      this.tours.catalogue(),
      this.preferences.lister(),
      this.recettes.lister([]),
    ]);

    return {
      catalogue,
      preferences,
      versions,
      recettes: recettes.map(({ id, title, updatedAt, lines }) => ({
        id,
        title,
        updatedAt,
        lines: lines.map(({ ingredient }) => ({
          ingredientId: ingredient.id,
          label: ingredient.displayName,
        })),
      })),
    };
  }

  private async planning(id: string): Promise<MealPlanRecord> {
    const planning = await this.plannings.lire(id);
    if (!planning) {
      throw new Introuvable(
        'food.plan_not_found',
        'Aucun Planning de repas de cet identifiant.',
      );
    }
    return planning;
  }

  /**
   * Les créneaux demandés au premier tour, comme un repas saisi : un jour de
   * la semaine, au moins un Participant, chacun un Compte du Foyer.
   */
  private async verifierLesCreneaux(
    planning: MealPlanRecord,
    demandes: readonly Creneau[],
    compteId: string,
  ): Promise<void> {
    if (demandes.some(({ day }) => !estDansLaSemaine(day, planning.week))) {
      throw new ErreurMetier(
        'food.entry_out_of_week',
        "Ce jour n'est pas dans la semaine du planning.",
      );
    }
    if (demandes.some(({ participantIds }) => participantIds.length === 0)) {
      throw new ErreurMetier(
        'food.entry_no_participant',
        'Un repas a au moins un Participant.',
      );
    }
    const ids = unique(
      demandes.flatMap(({ participantIds }) => participantIds),
    );
    const membres = await this.plannings.membresDuFoyer(ids, compteId);
    if (membres.size !== ids.length) {
      throw new ErreurMetier(
        'food.unknown_participant',
        "Un Participant n'est pas un Compte du Foyer.",
      );
    }
  }

  /**
   * L'écriture échoue si, depuis leur lecture, le planning ou une donnée du
   * contrôle a changé, ou si un autre tour a été lancé (P2025, P2002), ou si
   * une Recette ou un Ingrédient a disparu (P2003) : on relit le planning pour
   * dire pourquoi. Un tour encore possible est à relancer.
   */
  private async ecrire<T>(operation: Promise<T>, planId: string): Promise<T> {
    try {
      return await operation;
    } catch (erreur) {
      const code = codePrisma(erreur);
      if (code !== 'P2002' && code !== 'P2025' && code !== 'P2003') {
        throw erreur;
      }
      const etat = enPlanningDuTour(await this.planning(planId));
      if (
        etat.status === 'STOPPED' ||
        etat.entries.some(({ decision }) => decision === 'PROPOSED')
      ) {
        throw tourImpossible(etat);
      }
      throw tourPerime();
    }
  }
}

/** Le contexte du contrôle, avec la version de chaque donnée lue. */
interface DonneesDuControle extends ContexteDuControle {
  catalogue: CatalogueDuTour;
  recettes: (RecetteDuControle & { title: string; updatedAt: Date })[];
  versions: LecturesDuTour['comptes'];
}

/**
 * Les versions sur lesquelles le contrôle s'est fondé : le planning lu avant
 * l'appel au modèle, et ce que les repas retenus citent, lu à sa réponse.
 */
function lecturesDuTour(
  planning: MealPlanRecord,
  retenues: readonly Retenue[],
  donnees: DonneesDuControle,
): LecturesDuTour {
  const recettes = retenues.flatMap(({ recette }) =>
    'recipeId' in recette
      ? donnees.recettes.filter(({ id }) => id === recette.recipeId)
      : [],
  );
  const ingredientIds = new Set(
    retenues.flatMap(({ recette }) =>
      'recipeId' in recette
        ? recettes
            .filter(({ id }) => id === recette.recipeId)
            .flatMap(({ lines }) =>
              lines.map(({ ingredientId }) => ingredientId),
            )
        : recette.nouvelle.lignes.map(({ ingredientId }) => ingredientId),
    ),
  );

  return {
    planning: planning.version,
    recettes: uniqueParId(recettes).map(({ id, updatedAt }) => ({
      id,
      updatedAt,
    })),
    ingredients: donnees.catalogue.ingredients
      .filter(({ id }) => ingredientIds.has(id))
      .map(({ id, updatedAt }) => ({ id, updatedAt })),
    comptes: donnees.versions,
  };
}

function uniqueParId<T extends { id: string }>(elements: readonly T[]): T[] {
  return [
    ...new Map(elements.map((element) => [element.id, element])).values(),
  ];
}

function tourPerime(): ErreurMetier {
  return new ErreurMetier(
    'food.round_outdated',
    'Le planning, une Recette ou des Préférences ont changé pendant la génération : relancez le tour.',
  );
}

/** Ce que la machine à tours lit du planning. */
function enPlanningDuTour(planning: MealPlanRecord): PlanningDuTour {
  const dernier = planning.rounds.at(-1);
  return {
    status: planning.status,
    entries: planning.entries,
    toursLances: planning.rounds.length,
    ecartes: dernier ? dernier.rejected.map(({ slot }) => slot) : [],
  };
}

/** Le message dit lequel des trois empêchements tient le tour. */
function tourImpossible(planning: PlanningDuTour): ErreurMetier {
  const message =
    planning.status === 'STOPPED'
      ? 'Ce planning est arrêté : rouvrez-le pour lancer un tour.'
      : planning.entries.some(({ decision }) => decision === 'PROPOSED')
        ? "Un repas proposé attend encore d'être approuvé ou refusé."
        : planning.toursLances === 0
          ? 'Aucun créneau à remplir : choisissez les repas à générer.'
          : 'Aucun repas refusé ni créneau écarté : rien à régénérer.';
  return new ErreurMetier('food.round_not_allowed', message);
}

function enRepasDeLaDemande(repas: MealPlanEntryRecord): RepasDeLaDemande {
  return {
    day: repas.day,
    moment: repas.moment,
    decision: repas.decision,
    recipe: repas.recipe,
    title: repas.title,
  };
}

/** Un jour civil décalé de quelques jours, à minuit UTC, sans fuseau. */
function decaler(jour: string, jours: number): string {
  const date = new Date(`${jour}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + jours);
  return date.toISOString().slice(0, 10);
}

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

function codePrisma(erreur: unknown): unknown {
  return typeof erreur === 'object' && erreur !== null && 'code' in erreur
    ? erreur.code
    : undefined;
}
