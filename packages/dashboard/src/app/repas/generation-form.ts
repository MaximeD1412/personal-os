import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  LIBELLES_DES_MOMENTS,
  lundiDe,
  MOMENTS_DE_REPAS,
  zGenerationSlotInput,
  type GenerationSlotInput,
  type MealMoment,
} from '@personal-os/contracts';
import { HlmAlertImports } from '@personal-os/ui/alert';
import { HlmCheckbox } from '@personal-os/ui/checkbox';
import {
  DccmFormPage,
  DccmState,
  DccmStepper,
  stateOf,
  type DccmStateStatus,
} from '@personal-os/ui/dccm';
import { HlmFieldImports } from '@personal-os/ui/field';
import { showToast } from '@personal-os/ui/sonner';
import { decaler, formaterJour } from '../dates';
import type { ErreurApi } from '../erreur-api.interceptor';
import { erreursDeChamp, prefillDepuisRequete } from '../formulaire';
import { HouseholdService } from '../household.service';
import { MealPlanService } from './meal-plan.service';
import {
  FIL_DU_PLANNING,
  libelleDeLaSemaine,
  PARAMETRE_DE_SEMAINE,
  resumeDuTour,
  semaineDemandee,
} from './planning';

/** Ce qu'on a choisi pour un créneau : le générer ou non, et sa tablée. */
interface Choix {
  coche: boolean;
  /** Les Comptes du Foyer décochés : tous participent tant qu'on n'y touche pas. */
  absents: readonly string[];
  invites: number | null;
}

/** Un créneau de la semaine, tel que le formulaire le montre. */
interface VueDeCreneau {
  cle: string;
  day: string;
  moment: MealMoment;
  libelle: string;
  /** Les repas qui l'occupent déjà : le tour ne le remplit pas. */
  occupe: string[];
  choix: Choix;
  participants: string[];
}

interface VueDuJour {
  jour: string;
  nom: string;
  creneaux: VueDeCreneau[];
}

function cleDe(day: string, moment: MealMoment): string {
  return `${day}-${moment}`;
}

/**
 * Le premier Tour de génération d'une semaine : `/repas/planning/generer`,
 * prérempli par sa requête aux noms des champs d'un créneau du contrat
 * (`?semaine=2026-10-19&day=2026-10-20&moment=DINNER&guestCount=2`). Le jour
 * dit la semaine ; sans jour, c'est `semaine`, puis la semaine en cours.
 *
 * Chaque créneau encore vide de la semaine est coché par défaut, avec tout le
 * Foyer pour Participants et aucun Invité ; `day` et `moment` restreignent
 * les créneaux cochés, `guestCount` donne les Invités de chacun. Un créneau
 * qui a déjà son repas n'est pas proposé.
 *
 * Rien ne s'envoie sans « Générer les repas » (ADR 0030). Les tours suivants
 * se relancent depuis le planning : ils ne lisent pas de créneaux.
 */
@Component({
  imports: [
    HlmAlertImports,
    HlmCheckbox,
    DccmFormPage,
    DccmState,
    DccmStepper,
    HlmFieldImports,
  ],
  templateUrl: './generation-form.html',
})
export class FormulaireDeGeneration {
  private readonly router = inject(Router);
  private readonly service = inject(MealPlanService);

  private readonly parametres = inject(ActivatedRoute).snapshot.queryParamMap;

  /**
   * Quitté pendant l'envoi : le tour se crée quand même, et son résumé
   * s'annonce, mais il ne ramène plus au planning de sa semaine.
   */
  private quitte = false;

  protected readonly prefill = prefillDepuisRequete(
    zGenerationSlotInput,
    this.parametres,
  );

  /** La semaine du planning : celle du jour demandé, sinon celle du lien. */
  protected readonly semaine = this.prefill.valeurs.day
    ? lundiDe(this.prefill.valeurs.day)
    : semaineDemandee(this.parametres.get(PARAMETRE_DE_SEMAINE));

  protected readonly planning = this.service.planning(() => this.semaine);
  protected readonly foyer = inject(HouseholdService).foyer();

  /** Le formulaire attend le Foyer et le planning ; la première erreur l'emporte. */
  protected readonly etat = computed<DccmStateStatus>(() => {
    const etats = [
      stateOf(this.foyer, () => false),
      stateOf(this.planning, () => false),
    ];
    if (etats.includes('error')) return 'error';
    return etats.includes('loading') ? 'loading' : 'ready';
  });
  protected readonly erreurDeLecture = computed(
    () => this.foyer.error() ?? this.planning.error(),
  );

  protected readonly membres = computed(() =>
    this.foyer.hasValue() ? (this.foyer.value()?.members ?? []) : [],
  );

  private readonly lu = computed(() =>
    this.planning.hasValue() ? this.planning.value() : undefined,
  );

  /** Pourquoi ce formulaire ne lance rien : le tour se relance d'ailleurs. */
  protected readonly empechement = computed(() => {
    const planning = this.lu();
    if (planning?.status === 'STOPPED') {
      return 'Ce planning est arrêté : rouvrez-le pour générer ses repas.';
    }
    if (planning && planning.rounds.length > 0) {
      return 'Le premier tour est lancé : les tours suivants se relancent depuis le planning, sur les repas refusés et les créneaux écartés.';
    }
    return null;
  });

  /** Les choix faits à la main ; un créneau sans choix garde ceux du lien. */
  private readonly choix = signal<Readonly<Record<string, Choix>>>({});

  private choixDe(day: string, moment: MealMoment): Choix {
    const { valeurs } = this.prefill;
    return (
      this.choix()[cleDe(day, moment)] ?? {
        coche:
          (valeurs.day === undefined || valeurs.day === day) &&
          (valeurs.moment === undefined || valeurs.moment === moment),
        absents: [],
        invites: valeurs.guestCount ?? 0,
      }
    );
  }

  protected readonly jours = computed<VueDuJour[]>(() => {
    const repas = this.lu()?.entries ?? [];
    const ids = this.membres().map(({ id }) => id);
    return Array.from({ length: 7 }, (_, rang) => {
      const jour = decaler(this.semaine, rang);
      return {
        jour,
        nom: formaterJour(jour, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }),
        creneaux: MOMENTS_DE_REPAS.map((moment) => {
          const choix = this.choixDe(jour, moment);
          return {
            cle: cleDe(jour, moment),
            day: jour,
            moment,
            libelle: LIBELLES_DES_MOMENTS[moment],
            occupe: repas
              .filter((un) => un.day === jour && un.moment === moment)
              .map((un) => un.recipe?.title ?? un.title ?? ''),
            choix,
            participants: ids.filter((id) => !choix.absents.includes(id)),
          };
        }),
      };
    });
  });

  /** Les créneaux à générer, dans l'ordre de la semaine. */
  private readonly aGenerer = computed(() =>
    this.empechement()
      ? []
      : this.jours()
          .flatMap(({ creneaux }) => creneaux)
          .filter(({ occupe, choix }) => occupe.length === 0 && choix.coche),
  );

  protected readonly rien = computed(() => this.aGenerer().length === 0);
  protected readonly compte = computed(() => {
    const n = this.aGenerer().length;
    return n === 0
      ? 'Aucun créneau à générer'
      : `${n} créneau${n > 1 ? 'x' : ''} à générer`;
  });

  protected readonly envoi = signal(false);
  protected readonly refus = signal<ErreurApi | null>(null);
  /** Les créneaux du dernier envoi, dans l'ordre : l'API vise un créneau par son rang. */
  private readonly envoyes = signal<readonly string[]>([]);

  /** L'erreur que l'API rattache à un créneau (`slots.<rang>.<champ>`). */
  protected readonly erreursDesCreneaux = computed(() => {
    const parCreneau: Record<string, string> = {};
    for (const [chemin, message] of Object.entries(
      erreursDeChamp(this.refus()),
    )) {
      const rang = /^slots\.(\d+)(\.|$)/.exec(chemin)?.[1];
      const cle = rang === undefined ? undefined : this.envoyes()[Number(rang)];
      if (cle) parCreneau[cle] ??= message;
    }
    return parCreneau;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.quitte = true));
  }

  protected readonly titre = libelleDeLaSemaine(this.semaine);
  protected readonly fil = [
    ...FIL_DU_PLANNING,
    { label: 'Générer la semaine' },
  ];

  protected cocher(creneau: VueDeCreneau, coche: boolean): void {
    this.choisir(creneau, { ...creneau.choix, coche });
  }

  protected cocherLeParticipant(
    creneau: VueDeCreneau,
    id: string,
    coche: boolean,
  ): void {
    const absents = creneau.choix.absents.filter((un) => un !== id);
    this.choisir(creneau, {
      ...creneau.choix,
      absents: coche ? absents : [...absents, id],
    });
  }

  protected changerLesInvites(
    creneau: VueDeCreneau,
    invites: number | null,
  ): void {
    this.choisir(creneau, { ...creneau.choix, invites });
  }

  protected generer(): void {
    const planning = this.lu();
    const creneaux = this.aGenerer();
    if (!planning || creneaux.length === 0) return;

    const slots: GenerationSlotInput[] = creneaux.map(
      ({ day, moment, participants, choix }) => ({
        day,
        moment,
        participantIds: participants,
        guestCount: choix.invites ?? 0,
      }),
    );

    this.envoi.set(true);
    this.refus.set(null);
    this.envoyes.set(creneaux.map(({ cle }) => cle));
    this.service.lancerUnTour(planning.id, { slots }).subscribe({
      next: (tour) => {
        this.envoi.set(false);
        showToast({ tone: 'success', message: resumeDuTour(tour) });
        if (!this.quitte) this.fermer();
      },
      error: (erreur: ErreurApi) => {
        this.envoi.set(false);
        this.refus.set(erreur);
      },
    });
  }

  protected fermer(): void {
    void this.router.navigate(['/repas/planning'], {
      queryParams: { [PARAMETRE_DE_SEMAINE]: this.semaine },
    });
  }

  private choisir(creneau: VueDeCreneau, choix: Choix): void {
    this.choix.update((tous) => ({ ...tous, [creneau.cle]: choix }));
  }
}
