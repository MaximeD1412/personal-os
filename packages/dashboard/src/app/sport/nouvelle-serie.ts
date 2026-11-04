import {
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  aujourdhui,
  JOURS_DE_LA_SEMAINE,
  LIBELLES_DE_SPORT,
  SEANCES_PAR_SERIE_AU_PLUS,
  TRAINING_SPORTS,
  zTrainingSeriesInputFields,
  type ApiError,
  type TrainingSeriesInput,
  type TrainingSport,
  type Weekday,
} from '@personal-os/contracts';
import { HlmButton } from '@personal-os/ui/button';
import { DccmFormPage, DccmState, stateOf } from '@personal-os/ui/dccm';
import { HlmFieldImports } from '@personal-os/ui/field';
import { HlmInput } from '@personal-os/ui/input';
import { HlmSelectImports } from '@personal-os/ui/select';
import { showToast } from '@personal-os/ui/sonner';
import { erreursDeChamp, prefillDepuisRequete } from '../formulaire';
import { JOURS_OFFERTS } from '../saisie-de-recurrence';
import { ChampsDeMesures } from './champs-de-mesures';
import {
  lireLesMesures,
  saisieDesMesures,
  type SaisieDeMesures,
} from './saisie-de-seance';
import { TrainingGoalService } from './training-goal.service';

/**
 * La création de Séances en série vers un Objectif
 * (`/sport/objectifs/:id/seances/nouvelles`) : les jours de la semaine, la
 * période, l'heure, le sport et le prévu. Chaque jour choisi de la période
 * donne une Séance prévue, liée à l'Objectif et indépendante des autres : il
 * n'y a ni plan ni semaine (ADR 0022).
 *
 * Préremplie par son lien
 * (`?weekdays=TU&weekdays=TH&from=2026-11-09&time=07:15&plannedDistanceM=8000`,
 * ADR 0030) ; la période finit par défaut au jour de l'Objectif. Rien n'est
 * enregistré sans clic.
 */
@Component({
  selector: 'pos-nouvelle-serie',
  templateUrl: './nouvelle-serie.html',
  imports: [
    ChampsDeMesures,
    DccmFormPage,
    DccmState,
    HlmButton,
    HlmFieldImports,
    HlmInput,
    ...HlmSelectImports,
  ],
})
export class NouvelleSerie {
  private readonly api = inject(TrainingGoalService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute).snapshot;

  protected readonly id = this.route.paramMap.get('id') ?? '';
  protected readonly lecture = this.api.lectureDe(() => this.id);
  private readonly objectif = computed(() =>
    this.lecture.hasValue() ? this.lecture.value() : undefined,
  );
  protected readonly etat = computed(() => stateOf(this.lecture, () => false));

  protected readonly jours = JOURS_OFFERTS;
  protected readonly sports = TRAINING_SPORTS.map((valeur) => ({
    valeur,
    libelle: LIBELLES_DE_SPORT[valeur],
  }));
  protected readonly auPlus = SEANCES_PAR_SERIE_AU_PLUS;

  protected readonly prefill = prefillDepuisRequete(
    zTrainingSeriesInputFields,
    this.route.queryParamMap,
  );

  protected readonly joursChoisis = signal<readonly Weekday[]>(
    this.prefill.valeurs.weekdays ?? [],
  );
  protected readonly du = signal(this.prefill.valeurs.from ?? aujourdhui());
  protected readonly au = signal(this.prefill.valeurs.to ?? '');
  protected readonly heure = signal(this.prefill.valeurs.time ?? '');
  protected readonly sport = signal<TrainingSport>(
    this.prefill.valeurs.sport ?? 'RUN',
  );
  protected readonly prevu = signal<SaisieDeMesures>(
    saisieDesMesures({
      distanceM: this.prefill.valeurs.plannedDistanceM,
      dureeS: this.prefill.valeurs.plannedDurationS,
      texte: this.prefill.valeurs.plannedIntent,
    }),
  );

  protected readonly envoi = signal(false);
  /** Le dernier refus de l'API, tel qu'elle l'a formulé. */
  protected readonly refus = signal<ApiError | null>(null);
  /** Les champs que l'écran n'a pas su lire, avant tout envoi. */
  private readonly illisibles = signal<Record<string, string>>({});
  protected readonly erreurs = computed(() => ({
    ...erreursDeChamp(this.refus()),
    ...this.illisibles(),
  }));

  protected readonly fil = computed(() => [
    { label: 'Sport', link: '/sport' },
    { label: 'Objectifs', link: '/sport/objectifs' },
    {
      label: this.objectif()?.title ?? '…',
      link: `/sport/objectifs/${this.id}`,
    },
    { label: 'Séances en série' },
  ]);

  protected readonly nomDuSport = (sport: TrainingSport | null | undefined) =>
    sport ? LIBELLES_DE_SPORT[sport] : '';

  constructor() {
    // Sans fin donnée par le lien, la période court jusqu'au jour de
    // l'Objectif, posé une fois, à sa première lecture.
    if (this.prefill.valeurs.to === undefined) {
      let rempli = false;
      effect(() => {
        const objectif = this.objectif();
        if (objectif && !rempli) {
          rempli = true;
          untracked(() => {
            if (!this.au()) {
              this.au.set(objectif.date);
            }
          });
        }
      });
    }
  }

  protected valeur(evenement: Event): string {
    return (evenement.target as HTMLInputElement).value;
  }

  protected estChoisi(jour: Weekday): boolean {
    return this.joursChoisis().includes(jour);
  }

  /** Ajoute ou retire un jour ; ils restent dans l'ordre de la semaine. */
  protected basculerLeJour(jour: Weekday): void {
    this.joursChoisis.update((jours) =>
      JOURS_DE_LA_SEMAINE.filter((candidat) =>
        candidat === jour ? !jours.includes(jour) : jours.includes(candidat),
      ),
    );
  }

  protected choisirLeSport(sport: TrainingSport | null | undefined): void {
    if (sport) {
      this.sport.set(sport);
    }
  }

  protected enregistrer(): void {
    const saisie = this.serie();
    if (!saisie) {
      return;
    }

    this.envoi.set(true);
    this.refus.set(null);
    this.api.creerLaSerie(this.id, saisie).subscribe({
      next: (seances) => {
        this.envoi.set(false);
        showToast({
          message:
            seances.length > 1
              ? `${seances.length} séances créées.`
              : '1 séance créée.',
        });
        void this.router.navigate(['/sport/objectifs', this.id]);
      },
      error: (refus: ApiError) => {
        this.envoi.set(false);
        this.refus.set(refus);
      },
    });
  }

  protected fermer(): void {
    void this.router.navigate(['/sport/objectifs', this.id]);
  }

  /**
   * La série dans les termes du contrat ; `null` quand un champ du prévu ne se
   * lit pas. Le reste (jours, période, heure) est jugé par l'API, qui dit
   * sous quel champ.
   */
  private serie(): TrainingSeriesInput | null {
    const { mesures, erreurs } = lireLesMesures(this.prevu(), 'planned');
    this.illisibles.set(erreurs);
    if (Object.keys(erreurs).length > 0) {
      return null;
    }

    return {
      weekdays: [...this.joursChoisis()],
      from: this.du(),
      to: this.au(),
      time: this.heure(),
      sport: this.sport(),
      ...(mesures.distanceM === null
        ? {}
        : { plannedDistanceM: mesures.distanceM }),
      ...(mesures.dureeS === null ? {} : { plannedDurationS: mesures.dureeS }),
      ...(mesures.texte === null ? {} : { plannedIntent: mesures.texte }),
    };
  }
}
