import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  LIBELLES_DE_SPORT,
  TRAINING_SPORTS,
  zTrainingSessionInputFields,
  type ApiError,
  type TrainingSessionInput,
  type TrainingSport,
} from '@personal-os/contracts';
import { DccmFormPage } from '@personal-os/ui/dccm';
import { HlmFieldImports } from '@personal-os/ui/field';
import { HlmInput } from '@personal-os/ui/input';
import { HlmSelectImports } from '@personal-os/ui/select';
import { showToast } from '@personal-os/ui/sonner';
import { HlmToggleGroupImports } from '@personal-os/ui/toggle-group';
import { erreursDeChamp, prefillDepuisRequete } from '../formulaire';
import { ChampsDeMesures } from './champs-de-mesures';
import {
  lireLesMesures,
  saisieDesMesures,
  versChampLocal,
  versIso,
  type SaisieDeMesures,
} from './saisie-de-seance';
import { semaineDe } from './semaine';
import { PARAMETRE_DE_SEMAINE } from './sport';
import { TrainingSessionService } from './training-session.service';

type Statut = TrainingSessionInput['status'];

/**
 * La création d'une Séance, adressable et préremplie par son lien
 * (`/sport/seances/nouvelle?sport=RUN&plannedDistanceM=10000`, ADR 0030) :
 * les paramètres portent les noms des champs du contrat, et un paramètre
 * refusé est signalé, jamais appliqué.
 *
 * Une Séance naît prévue, avec son prévu, ou déjà réalisée — une sortie non
 * planifiée —, avec son réalisé et sans prévu (ADR 0022). Le choix du statut
 * décide du volet que l'on saisit. Rien n'est enregistré sans clic.
 */
@Component({
  selector: 'pos-nouvelle-seance',
  templateUrl: './nouvelle-seance.html',
  imports: [
    ChampsDeMesures,
    DccmFormPage,
    HlmFieldImports,
    HlmInput,
    ...HlmSelectImports,
    ...HlmToggleGroupImports,
  ],
})
export class NouvelleSeance {
  private readonly api = inject(TrainingSessionService);
  private readonly router = inject(Router);

  protected readonly sports = TRAINING_SPORTS.map((valeur) => ({
    valeur,
    libelle: LIBELLES_DE_SPORT[valeur],
  }));

  protected readonly prefill = prefillDepuisRequete(
    zTrainingSessionInputFields,
    inject(ActivatedRoute).snapshot.queryParamMap,
  );

  protected readonly statut = signal<Statut>(
    this.prefill.valeurs.status ?? 'PLANNED',
  );
  protected readonly sport = signal<TrainingSport>(
    this.prefill.valeurs.sport ?? 'RUN',
  );
  protected readonly debut = signal(
    this.prefill.valeurs.startsAt
      ? versChampLocal(this.prefill.valeurs.startsAt)
      : '',
  );
  protected readonly prevu = signal<SaisieDeMesures>(
    saisieDesMesures({
      distanceM: this.prefill.valeurs.plannedDistanceM,
      dureeS: this.prefill.valeurs.plannedDurationS,
      texte: this.prefill.valeurs.plannedIntent,
    }),
  );
  protected readonly realise = signal<SaisieDeMesures>(
    saisieDesMesures({
      distanceM: this.prefill.valeurs.actualDistanceM,
      dureeS: this.prefill.valeurs.actualDurationS,
      texte: this.prefill.valeurs.actualNotes,
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

  protected readonly titre = computed(() =>
    this.statut() === 'DONE' ? 'Sortie non planifiée' : 'Nouvelle séance',
  );

  protected readonly nomDuSport = (sport: TrainingSport | null | undefined) =>
    sport ? LIBELLES_DE_SPORT[sport] : '';

  protected choisirLeStatut(
    statut: Statut | Statut[] | null | undefined,
  ): void {
    if (statut === 'PLANNED' || statut === 'DONE') {
      this.statut.set(statut);
    }
  }

  protected choisirLeSport(sport: TrainingSport | null | undefined): void {
    if (sport) {
      this.sport.set(sport);
    }
  }

  protected saisirLeDebut(evenement: Event): void {
    this.debut.set((evenement.target as HTMLInputElement).value);
  }

  protected enregistrer(): void {
    const saisie = this.saisieCreee();
    if (!saisie) {
      return;
    }

    this.envoi.set(true);
    this.api.creer(saisie).subscribe({
      next: (seance) => {
        this.envoi.set(false);
        showToast({ message: 'Séance enregistrée.' });
        void this.router.navigate(['/sport'], {
          queryParams: { [PARAMETRE_DE_SEMAINE]: semaineDe(seance.startsAt) },
        });
      },
      error: (refus: ApiError) => {
        this.envoi.set(false);
        this.refus.set(refus);
      },
    });
  }

  protected fermer(): void {
    void this.router.navigate(['/sport']);
  }

  /**
   * La saisie dans les termes du contrat : seul le volet du statut choisi
   * part, l'autre reste à l'écran. `null` quand un champ ne se lit pas.
   */
  private saisieCreee(): TrainingSessionInput | null {
    const volet = this.statut() === 'PLANNED' ? 'planned' : 'actual';
    const { mesures, erreurs } = lireLesMesures(
      volet === 'planned' ? this.prevu() : this.realise(),
      volet,
    );
    if (!this.debut()) {
      erreurs['startsAt'] = 'La date et l’heure de la séance.';
    }
    this.illisibles.set(erreurs);
    if (Object.keys(erreurs).length > 0) {
      return null;
    }

    const base = {
      startsAt: versIso(this.debut()),
      sport: this.sport(),
    };
    const sansVide = <T extends object>(valeurs: T) =>
      Object.fromEntries(
        Object.entries(valeurs).filter(([, valeur]) => valeur !== null),
      ) as { [K in keyof T]?: NonNullable<T[K]> };

    return volet === 'planned'
      ? {
          ...base,
          status: 'PLANNED',
          ...sansVide({
            plannedDistanceM: mesures.distanceM,
            plannedDurationS: mesures.dureeS,
            plannedIntent: mesures.texte,
          }),
        }
      : {
          ...base,
          status: 'DONE',
          ...sansVide({
            actualDistanceM: mesures.distanceM,
            actualDurationS: mesures.dureeS,
            actualNotes: mesures.texte,
          }),
        };
  }
}
