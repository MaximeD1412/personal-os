import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import {
  matAddOutline,
  matCheckCircleOutline,
  matChevronLeftOutline,
  matChevronRightOutline,
  matLockOpenOutline,
  matLockOutline,
  matScheduleOutline,
  matCancelOutline,
} from '@ng-icons/material-symbols/outline';
import {
  aujourdhui,
  LIBELLES_DES_DECISIONS,
  LIBELLES_DES_MOMENTS,
  lundiDe,
  MOMENTS_DE_REPAS,
  zWeek,
  type MealMoment,
  type MealPlan,
  type MealPlanEntry,
  type MealPlanEntryDecision,
} from '@personal-os/contracts';
import { HlmAlertImports } from '@personal-os/ui/alert';
import { HlmBadge } from '@personal-os/ui/badge';
import { HlmButton } from '@personal-os/ui/button';
import {
  DccmConfirm,
  DccmPageHeader,
  DccmState,
  stateOf,
  type DccmCrumb,
} from '@personal-os/ui/dccm';
import { showToast } from '@personal-os/ui/sonner';
import { map } from 'rxjs';
import { decaler, formaterJour } from '../dates';
import type { ErreurApi } from '../erreur-api.interceptor';
import { HouseholdService } from '../household.service';
import { MealPlanService } from './meal-plan.service';

/** Le paramètre de requête qui porte la semaine affichée, par son lundi. */
export const PARAMETRE_DE_SEMAINE = 'semaine';

/** Le fil d'Ariane des écrans du Planning de repas. */
export const FIL_DU_PLANNING: readonly DccmCrumb[] = [
  { label: 'Cuisine' },
  { label: 'Planning de repas', link: '/repas/planning' },
];

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
  initiales: string[];
  participants: string;
  portions: string;
  invites: string | null;
}

interface Creneau {
  moment: MealMoment;
  libelle: string;
  repas: VueDeRepas[];
}

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
 * L'ajout passe par le formulaire de sa route, prérempli du jour et du
 * moment du créneau. Arrêter et rouvrir le planning sont des transitions,
 * confirmées par `DccmConfirm`.
 */
@Component({
  imports: [
    RouterLink,
    NgIcon,
    HlmAlertImports,
    HlmBadge,
    HlmButton,
    DccmPageHeader,
    DccmState,
  ],
  templateUrl: './planning.html',
})
export class PlanningDeRepas {
  private readonly router = inject(Router);
  private readonly service = inject(MealPlanService);
  private readonly confirmation = inject(DccmConfirm);

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

  /** La transition en cours, le temps de la requête. */
  protected readonly transition = signal(false);
  /** Le refus de la dernière transition, en bandeau : jamais en toast seul. */
  protected readonly refus = signal<ErreurApi | null>(null);

  private readonly noms = computed(() => {
    const membres = this.foyer.hasValue()
      ? (this.foyer.value()?.members ?? [])
      : [];
    return new Map(membres.map(({ id, displayName }) => [id, displayName]));
  });

  protected readonly jours = computed<Jour[]>(() => {
    const repas = this.planning()?.entries ?? [];
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
    const confirme = await this.confirmation.confirm({
      title: 'Arrêter le planning de la semaine ?',
      description:
        "Ses repas ne se modifieront plus tant qu'il ne sera pas rouvert. C'est d'un planning arrêté que se tire la liste de courses.",
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

  protected parametresDAjout(jour: string, moment: MealMoment) {
    return { [PARAMETRE_DE_SEMAINE]: this.semaine(), day: jour, moment };
  }

  /**
   * La réponse ne touche l'écran que s'il montre encore la semaine de départ :
   * on a pu passer à une autre pendant la requête.
   */
  private changerDeStatut(geste: 'arreter' | 'rouvrir', message: string): void {
    const planning = this.planning();
    if (!planning) return;
    const toujoursAffiche = () => this.semaine() === planning.week;

    this.transition.set(true);
    this.refus.set(null);
    this.service[geste](planning.id).subscribe({
      next: (nouveau) => {
        this.transition.set(false);
        if (toujoursAffiche()) this.lecture.set(nouveau);
        showToast({ tone: 'success', message });
      },
      error: (erreur: ErreurApi) => {
        this.transition.set(false);
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
      initiales: noms.map((nom) => nom.trim().charAt(0).toUpperCase()),
      participants: `Participants : ${noms.join(', ')}`,
      portions: `${repas.servings} portion${repas.servings > 1 ? 's' : ''}`,
      invites:
        repas.guestCount > 0
          ? `dont ${repas.guestCount} invité${repas.guestCount > 1 ? 's' : ''}`
          : null,
    };
  }
}
