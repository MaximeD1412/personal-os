import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  Router,
  RouterLink,
  type ParamMap,
} from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import {
  matAddOutline,
  matAutorenewOutline,
  matCancelOutline,
  matCheckCircleOutline,
  matCheckOutline,
  matChevronLeftOutline,
  matChevronRightOutline,
  matCloseOutline,
  matGppMaybeOutline,
  matLockOpenOutline,
  matLockOutline,
  matReceiptLongOutline,
  matScheduleOutline,
  matSkilletOutline,
  matShoppingCartOutline,
  matStarOutline,
  matStarsOutline,
} from '@ng-icons/material-symbols/outline';
import {
  aujourdhui,
  LIBELLES_DES_DECISIONS,
  LIBELLES_DES_MOMENTS,
  lundiDe,
  MOMENTS_DE_REPAS,
  zWeek,
  type GenerationRound,
  type MealMoment,
  type MealPlan,
  type MealPlanEntry,
  type MealPlanEntryDecision,
  type MealPlanEntryDecisionInput,
  type Recipe,
} from '@personal-os/contracts';
import { HlmAlertImports } from '@personal-os/ui/alert';
import { HlmBadge } from '@personal-os/ui/badge';
import { HlmButton } from '@personal-os/ui/button';
import { HlmCardImports } from '@personal-os/ui/card';
import {
  DccmConfirm,
  DccmPageHeader,
  DccmState,
  stateOf,
  type DccmCrumb,
} from '@personal-os/ui/dccm';
import { showToast } from '@personal-os/ui/sonner';
import { map, type Observable } from 'rxjs';
import { decaler, formaterJour } from '../dates';
import type { ErreurApi } from '../erreur-api.interceptor';
import { PARAMETRE_DES_ECARTES } from '../formulaire';
import { HouseholdService } from '../household.service';
import { EcartDuPlanning } from '../courses/ecart-du-planning';
import { ShoppingListService } from '../courses/shopping-list.service';
import { MealPlanService } from './meal-plan.service';
import { confirmerLaGarde } from './keep-confirmation';
import { RecipeService } from './recipe.service';
import { raisonDuRejet } from './rejet';
import { SouhaitsDeLaSemaine } from './souhaits';

/** Le paramètre de requête qui porte la semaine affichée, par son lundi. */
export const PARAMETRE_DE_SEMAINE = 'semaine';

/** Le fil d'Ariane des écrans du Planning de repas. */
export const FIL_DU_PLANNING: readonly DccmCrumb[] = [
  { label: 'Cuisine' },
  { label: 'Planning de repas', link: '/repas/planning' },
];

/**
 * Ce que le lien demandait comme semaine sans que l'écran puisse le prendre :
 * une valeur qui n'est pas un lundi (`semaine=2026-10-21`), ou la semaine que
 * la barre de commande a écartée, par son seul nom (`?ignored=semaine`). Le
 * planning la signale, puis montre la semaine en cours (ADR 0030).
 */
export function semaineEcartee(parametres: ParamMap): string[] {
  const brute = parametres.get(PARAMETRE_DE_SEMAINE);
  return [
    ...(brute !== null && !zWeek.safeParse(brute).success
      ? [`${PARAMETRE_DE_SEMAINE}=${brute}`]
      : []),
    ...parametres
      .getAll(PARAMETRE_DES_ECARTES)
      .filter((nom) => nom === PARAMETRE_DE_SEMAINE),
  ];
}

/** La semaine du lien, si c'est bien un lundi ; la semaine en cours sinon. */
export function semaineDemandee(brute: string | null): string {
  return zWeek.safeParse(brute).success
    ? (brute as string)
    : lundiDe(aujourdhui());
}

/** « Semaine du 19 au 25 octobre 2026 », mois et année écrits une fois. */
export function libelleDeLaSemaine(lundi: string): string {
  const dimanche = decaler(lundi, 6);
  const memeAnnee = lundi.slice(0, 4) === dimanche.slice(0, 4);
  const memeMois = lundi.slice(0, 7) === dimanche.slice(0, 7);
  const debut = formaterJour(lundi, {
    day: 'numeric',
    ...(memeMois ? {} : { month: 'long' }),
    ...(memeAnnee ? {} : { year: 'numeric' }),
  });
  const fin = formaterJour(dimanche, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return `Semaine du ${debut} au ${fin}`;
}

/** « 2 repas proposés », « aucun créneau écarté ». */
function compter(n: number, singulier: string, pluriel: string): string {
  return n === 0 ? `aucun ${singulier}` : `${n} ${n > 1 ? pluriel : singulier}`;
}

/** Ce qu'un tour a donné, en une phrase : le toast qui le confirme. */
export function resumeDuTour({
  number,
  entries,
  rejected,
}: GenerationRound): string {
  return `Tour ${number} : ${compter(entries.length, 'repas proposé', 'repas proposés')}, ${compter(rejected.length, 'créneau écarté', 'créneaux écartés')}.`;
}

/** La clé d'un créneau de la semaine. */
function cleDuCreneau(day: string, moment: MealMoment): string {
  return `${day} ${moment}`;
}

/** Le sens d'une décision : la tonalité de son badge, et son icône. */
const DECISIONS: Readonly<
  Record<
    MealPlanEntryDecision,
    { tone: 'success' | 'warning' | 'error'; icone: string }
  >
> = {
  APPROVED: { tone: 'success', icone: matCheckCircleOutline },
  PROPOSED: { tone: 'warning', icone: matScheduleOutline },
  REFUSED: { tone: 'error', icone: matCancelOutline },
};

/** Un repas tel que la grille le montre. */
interface VueDeRepas {
  id: string;
  titre: string;
  decision: string;
  tone: 'success' | 'warning' | 'error';
  icone: string;
  /** Il attend qu'on l'approuve ou le refuse. */
  propose: boolean;
  /** Refusé, il reste barré jusqu'au tour qui le remplace. */
  refuse: boolean;
  initiales: string[];
  participants: string;
  portions: string;
  invites: string | null;
  /** Seul un repas approuvé se déclare cuisiné. */
  approuve: boolean;
  /** La recette qu'il cuisine, dont la fiche s'ouvre d'ici. */
  recetteId: string | null;
  /** Approuvé, d'une recette générée qu'on n'a pas gardée : elle se garde d'ici. */
  gardable: boolean;
}

interface Creneau {
  moment: MealMoment;
  libelle: string;
  repas: VueDeRepas[];
  /** Pourquoi le contrôle du dernier tour a laissé ce créneau vide. */
  ecarte: string | null;
}

/** Un Tour de génération, tel que la liste des tours le montre. */
interface VueDeTour {
  id: string;
  titre: string;
  date: string;
  ecartes: string;
  traceId: string | null;
}

/** Ce qui est en cours d'envoi : une transition du planning, ou la décision sur un repas. */
type EnCours =
  | 'arreter'
  | 'rouvrir'
  | 'relancer'
  | 'produire'
  | { repas: string; decision: MealPlanEntryDecisionInput['decision'] }
  | { garder: string };

interface Jour {
  jour: string;
  nom: string;
  date: string;
  estAujourdhui: boolean;
  creneaux: Creneau[];
}

/**
 * Le Planning de repas d'une semaine : `/repas/planning?semaine=YYYY-MM-DD`
 * (le lundi), la semaine en cours sans paramètre. Sept jours, chacun avec
 * son déjeuner et son dîner : en grille à partir de 1280 px, empilés en
 * dessous.
 *
 * Au-dessus de la grille, les Souhaits de la semaine. L'ajout d'un repas
 * passe par le formulaire de sa route, prérempli du jour et du moment du
 * créneau. Un repas approuvé se déclare cuisiné par son propre formulaire
 * (`/repas/cuisine/nouveau?mealPlanEntryId=…`). Arrêter et rouvrir le
 * planning sont des transitions, confirmées par `DccmConfirm`.
 *
 * La génération : « Générer la semaine » mène au formulaire du premier tour.
 * Chaque repas proposé s'approuve ou se refuse à sa place. « Relancer un
 * tour » attend que chaque repas soit statué, et qu'il reste un refusé ou un
 * créneau écarté à remplir ; un créneau écarté dit pourquoi, à sa place.
 * Chaque tour mène à sa Trace IA.
 *
 * Le planning signale ce que ses listes déjà produites ne couvrent plus (un
 * repas ajouté après elles), ouvert pendant qu'on le modifie ; arrêté, il en
 * produit la liste de complément.
 *
 * Chaque repas d'après une recette mène à sa fiche. Un repas approuvé d'une
 * recette générée qu'on n'a pas gardée propose « Garder la recette » : elle
 * rejoint « Mes recettes », et la génération la proposera en priorité.
 */
@Component({
  imports: [
    RouterLink,
    NgIcon,
    HlmAlertImports,
    HlmBadge,
    HlmButton,
    HlmCardImports,
    DccmPageHeader,
    DccmState,
    SouhaitsDeLaSemaine,
    EcartDuPlanning,
  ],
  templateUrl: './planning.html',
})
export class PlanningDeRepas {
  private readonly router = inject(Router);
  private readonly service = inject(MealPlanService);
  private readonly confirmation = inject(DccmConfirm);
  private readonly listes = inject(ShoppingListService);
  private readonly recettes = inject(RecipeService);

  protected readonly fil: readonly DccmCrumb[] = [
    FIL_DU_PLANNING[0],
    { label: 'Planning de repas' },
  ];

  protected readonly icones = {
    precedent: matChevronLeftOutline,
    suivant: matChevronRightOutline,
    ajouter: matAddOutline,
    arreter: matLockOutline,
    rouvrir: matLockOpenOutline,
    generer: matStarsOutline,
    relancer: matAutorenewOutline,
    approuver: matCheckOutline,
    refuser: matCloseOutline,
    ecarte: matGppMaybeOutline,
    trace: matReceiptLongOutline,
    cuisine: matSkilletOutline,
    produire: matShoppingCartOutline,
    garder: matStarOutline,
  };

  private readonly aujourdhui = aujourdhui();

  protected readonly semaine = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(
      map((parametres) =>
        semaineDemandee(parametres.get(PARAMETRE_DE_SEMAINE)),
      ),
    ),
    { requireSync: true },
  );

  protected readonly semaineDuLienEcartee = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map(semaineEcartee)),
    { requireSync: true },
  );

  protected readonly titre = computed(() => libelleDeLaSemaine(this.semaine()));

  protected readonly lecture = this.service.planning(this.semaine);
  protected readonly foyer = inject(HouseholdService).foyer();

  /** Une semaine se lit toujours en grille : vide, elle reste une semaine. */
  protected readonly etat = computed(() => stateOf(this.lecture, () => false));

  protected readonly planning = computed<MealPlan | undefined>(() =>
    this.lecture.hasValue() ? this.lecture.value() : undefined,
  );
  protected readonly ouvert = computed(
    () => this.planning()?.status === 'OPEN',
  );
  /**
   * Le planning dont l'écart se lit, ouvert ou arrêté : il se relit quand ses
   * repas ou son statut changent, pas à chaque relecture du planning.
   */
  protected readonly planningDeLEcart = computed(
    () => {
      const planning = this.planning();
      return planning
        ? {
            id: planning.id,
            status: planning.status,
            repas: JSON.stringify(
              planning.entries.map(({ id, recipe, servings, decision }) => [
                id,
                recipe?.id,
                servings,
                decision,
              ]),
            ),
          }
        : null;
    },
    {
      equal: (a, b) =>
        a?.id === b?.id && a?.status === b?.status && a?.repas === b?.repas,
    },
  );

  /** Ce qui s'envoie, le temps de la requête : les autres gestes attendent. */
  protected readonly enCours = signal<EnCours | null>(null);
  protected readonly transition = computed(() => this.enCours() !== null);
  /** Le refus de la dernière transition, en bandeau : jamais en toast seul. */
  protected readonly refus = signal<ErreurApi | null>(null);

  protected readonly noms = computed(() => {
    const membres = this.foyer.hasValue()
      ? (this.foyer.value()?.members ?? [])
      : [];
    return new Map(membres.map(({ id, displayName }) => [id, displayName]));
  });

  private readonly repas = computed(() => this.planning()?.entries ?? []);
  private readonly tours = computed(() => this.planning()?.rounds ?? []);

  /** Les repas proposés : tant qu'il en reste, on ne relance ni n'arrête. */
  protected readonly enAttente = computed(
    () => this.repas().filter(({ decision }) => decision === 'PROPOSED').length,
  );
  private readonly refuses = computed(
    () => this.repas().filter(({ decision }) => decision === 'REFUSED').length,
  );

  /** Les créneaux que le contrôle du dernier tour a vidés, et qui le sont restés. */
  private readonly ecartes = computed(() => {
    const occupes = new Set(
      this.repas().map(({ day, moment }) => cleDuCreneau(day, moment)),
    );
    return new Map(
      (this.tours()[this.tours().length - 1]?.rejected ?? [])
        .filter(({ slot }) => !occupes.has(cleDuCreneau(slot.day, slot.moment)))
        .map((rejet) => [
          cleDuCreneau(rejet.slot.day, rejet.slot.moment),
          raisonDuRejet(rejet, this.noms()),
        ]),
    );
  });

  /** Le premier tour se lance par son formulaire, qui choisit les créneaux. */
  protected readonly generable = computed(
    () => this.ouvert() && this.tours().length === 0,
  );
  /**
   * Un tour suivant ne régénère que les refusés et les créneaux écartés
   * (CUISINE-16) : il attend que chaque repas soit statué, et qu'il en reste.
   */
  protected readonly relancable = computed(
    () =>
      this.enAttente() === 0 && (this.refuses() > 0 || this.ecartes().size > 0),
  );

  protected readonly vueDesTours = computed<VueDeTour[]>(() =>
    this.tours().map((tour) => ({
      id: tour.id,
      titre: `Tour ${tour.number}`,
      date: new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: 'Europe/Paris',
      }).format(new Date(tour.createdAt)),
      ecartes:
        tour.rejected.length === 0
          ? 'Aucun créneau écarté'
          : compter(tour.rejected.length, 'créneau écarté', 'créneaux écartés'),
      traceId: tour.traceId,
    })),
  );

  protected readonly jours = computed<Jour[]>(() => {
    const repas = this.repas();
    const ecartes = this.ecartes();
    return Array.from({ length: 7 }, (_, rang) => {
      const jour = decaler(this.semaine(), rang);
      return {
        jour,
        nom: formaterJour(jour, { weekday: 'long' }),
        date: formaterJour(jour, { day: 'numeric', month: 'long' }),
        estAujourdhui: jour === this.aujourdhui,
        creneaux: MOMENTS_DE_REPAS.map((moment) => ({
          moment,
          libelle: LIBELLES_DES_MOMENTS[moment],
          repas: repas
            .filter((un) => un.day === jour && un.moment === moment)
            .map((un) => this.vueDe(un)),
          ecarte: ecartes.get(cleDuCreneau(jour, moment)) ?? null,
        })),
      };
    });
  });

  protected changerDeSemaine(sens: -1 | 1): void {
    this.afficher(decaler(this.semaine(), 7 * sens));
  }

  protected revenirAujourdhui(): void {
    this.afficher(lundiDe(this.aujourdhui));
  }

  protected async arreter(): Promise<void> {
    const refuses = this.refuses();
    const retires =
      refuses === 0
        ? ''
        : refuses === 1
          ? ' Le repas refusé est retiré.'
          : ` Les ${refuses} repas refusés sont retirés.`;
    const confirme = await this.confirmation.confirm({
      title: 'Arrêter le planning de la semaine ?',
      description: `Ses repas ne se modifieront plus tant qu'il ne sera pas rouvert. C'est d'un planning arrêté que se tire la liste de courses.${retires}`,
      confirmLabel: 'Arrêter le planning',
    });
    if (confirme) {
      this.changerDeStatut('arreter', 'Le planning de la semaine est arrêté.');
    }
  }

  protected async rouvrir(): Promise<void> {
    const confirme = await this.confirmation.confirm({
      title: 'Rouvrir le planning de la semaine ?',
      description:
        'Ses repas se modifient de nouveau. Une liste de courses déjà tirée ne change pas.',
      confirmLabel: 'Rouvrir le planning',
    });
    if (confirme) {
      this.changerDeStatut('rouvrir', 'Le planning de la semaine est rouvert.');
    }
  }

  /**
   * Fige la liste de courses du planning arrêté, puis l'ouvre. Un Ingrédient
   * qui ne se convertit pas fait refuser la liste entière : le bandeau nomme
   * chacun.
   */
  protected async produire(): Promise<void> {
    const planning = this.planning();
    if (!planning) return;
    const confirme = await this.confirmation.confirm({
      title: 'Produire la liste de courses ?',
      description:
        'Les besoins des repas approuvés, moins le Stock domestique. La liste se fige : une modification du planning ne la changera plus.',
      confirmLabel: 'Produire la liste',
    });
    if (!confirme) return;

    this.enCours.set('produire');
    this.refus.set(null);
    this.listes.produire(planning.id).subscribe({
      next: (liste) => {
        this.enCours.set(null);
        showToast({
          tone: 'success',
          message: 'La liste de courses est produite.',
        });
        void this.router.navigate(['/courses', liste.id]);
      },
      error: (erreur: ErreurApi) => {
        this.enCours.set(null);
        if (this.semaine() === planning.week) this.refus.set(erreur);
      },
    });
  }

  protected parametresDAjout(jour: string, moment: MealMoment) {
    return { [PARAMETRE_DE_SEMAINE]: this.semaine(), day: jour, moment };
  }

  protected async relancer(): Promise<void> {
    const confirme = await this.confirmation.confirm({
      title: 'Relancer un tour de génération ?',
      description:
        "L'IA propose un repas pour chaque repas refusé et chaque créneau écarté ; les repas approuvés ne changent pas. L'appel compte dans le plafond mensuel de dépense en IA.",
      confirmLabel: 'Relancer un tour',
    });
    const planning = this.planning();
    if (!confirme || !planning) return;

    this.envoyer(
      planning,
      'relancer',
      this.service.lancerUnTour(planning.id, { slots: [] }),
      resumeDuTour,
      () => this.lecture.reload(),
    );
  }

  /** Statuer sur un repas proposé ne demande pas de confirmation : rien ne se perd. */
  protected decider(
    repasId: string,
    decision: MealPlanEntryDecisionInput['decision'],
  ): void {
    const planning = this.planning();
    if (!planning) return;

    this.envoyer(
      planning,
      { repas: repasId, decision },
      this.service.decider(planning.id, repasId, decision),
      (repas) => {
        const titre = `«\u00a0${repas.recipe?.title ?? repas.title ?? ''}\u00a0»`;
        return repas.decision === 'APPROVED'
          ? `${titre} est approuvé.`
          : `${titre} est refusé : le prochain tour le remplacera.`;
      },
      (repas) =>
        this.lecture.update(
          (lu) =>
            lu && {
              ...lu,
              entries: lu.entries.map((un) =>
                un.id === repas.id ? repas : un,
              ),
            },
        ),
    );
  }

  protected decisionEnCours(
    repasId: string,
    decision: MealPlanEntryDecisionInput['decision'],
  ): boolean {
    const enCours = this.enCours();
    return (
      typeof enCours === 'object' &&
      enCours !== null &&
      'repas' in enCours &&
      enCours.repas === repasId &&
      enCours.decision === decision
    );
  }

  /**
   * Garder la recette d'un repas, sur le planning ouvert comme arrêté : la
   * garde touche la recette, pas le planning. Chacun de ses repas la dit
   * gardée.
   */
  protected async garder(recetteId: string): Promise<void> {
    const planning = this.planning();
    const titre = planning?.entries.find(
      ({ recipe }) => recipe?.id === recetteId,
    )?.recipe?.title;
    if (!planning || titre === undefined) return;
    if (!(await confirmerLaGarde(this.confirmation, titre))) return;

    this.envoyer(
      planning,
      { garder: recetteId },
      this.recettes.garder(recetteId),
      (recette: Recipe) =>
        `«\u00a0${recette.title}\u00a0» rejoint vos recettes.`,
      (recette) =>
        this.lecture.update(
          (lu) =>
            lu && {
              ...lu,
              entries: lu.entries.map((un) =>
                un.recipe?.id === recette.id
                  ? { ...un, recipe: { ...un.recipe, kept: true } }
                  : un,
              ),
            },
        ),
    );
  }

  protected gardeEnCours(recetteId: string): boolean {
    const enCours = this.enCours();
    return (
      typeof enCours === 'object' &&
      enCours !== null &&
      'garder' in enCours &&
      enCours.garder === recetteId
    );
  }

  protected parametresDeLaSemaine() {
    return { [PARAMETRE_DE_SEMAINE]: this.semaine() };
  }

  private changerDeStatut(geste: 'arreter' | 'rouvrir', message: string): void {
    const planning = this.planning();
    if (!planning) return;

    this.envoyer(
      planning,
      geste,
      this.service[geste](planning.id),
      () => message,
      (nouveau) => this.lecture.set(nouveau),
    );
  }

  /**
   * La réponse ne touche l'écran que s'il montre encore la semaine de départ :
   * on a pu passer à une autre pendant la requête. Un refus s'affiche en
   * bandeau et relit le planning : il a pu changer entre-temps.
   */
  private envoyer<T>(
    planning: MealPlan,
    geste: EnCours,
    requete: Observable<T>,
    message: (reponse: T) => string,
    appliquer: (reponse: T) => void,
  ): void {
    const toujoursAffiche = () => this.semaine() === planning.week;

    this.enCours.set(geste);
    this.refus.set(null);
    requete.subscribe({
      next: (reponse) => {
        this.enCours.set(null);
        if (toujoursAffiche()) appliquer(reponse);
        showToast({ tone: 'success', message: message(reponse) });
      },
      error: (erreur: ErreurApi) => {
        this.enCours.set(null);
        if (!toujoursAffiche()) return;
        this.refus.set(erreur);
        this.lecture.reload();
      },
    });
  }

  private afficher(semaine: string): void {
    this.refus.set(null);
    void this.router.navigate([], {
      queryParams: { [PARAMETRE_DE_SEMAINE]: semaine },
    });
  }

  private vueDe(repas: MealPlanEntry): VueDeRepas {
    const noms = repas.participantIds.map((id) => this.noms().get(id) ?? id);
    return {
      id: repas.id,
      titre: repas.recipe?.title ?? repas.title ?? '',
      decision: LIBELLES_DES_DECISIONS[repas.decision],
      ...DECISIONS[repas.decision],
      propose: repas.decision === 'PROPOSED',
      refuse: repas.decision === 'REFUSED',
      initiales: noms.map((nom) => nom.trim().charAt(0).toUpperCase()),
      participants: `Participants : ${noms.join(', ')}`,
      portions: `${repas.servings} portion${repas.servings > 1 ? 's' : ''}`,
      invites:
        repas.guestCount > 0
          ? `dont ${repas.guestCount} invité${repas.guestCount > 1 ? 's' : ''}`
          : null,
      approuve: repas.decision === 'APPROVED',
      recetteId: repas.recipe?.id ?? null,
      gardable: repas.decision === 'APPROVED' && repas.recipe?.kept === false,
    };
  }
}
