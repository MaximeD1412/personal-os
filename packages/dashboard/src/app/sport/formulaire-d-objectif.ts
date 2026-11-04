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
  zTrainingGoalInput,
  type ApiError,
  type TrainingGoalInput,
} from '@personal-os/contracts';
import { DccmFormPage, DccmState, stateOf } from '@personal-os/ui/dccm';
import { HlmFieldImports } from '@personal-os/ui/field';
import { HlmInput } from '@personal-os/ui/input';
import { showToast } from '@personal-os/ui/sonner';
import { erreursDeChamp, prefillDepuisRequete } from '../formulaire';
import { TrainingGoalService } from './training-goal.service';

/**
 * La création d'un Objectif (`/sport/objectifs/nouveau`) et sa modification
 * (`/sport/objectifs/:id/modifier`) : une course, son jour, une intention.
 * L'une et l'autre se préremplissent par leur lien
 * (`?title=Semi-marathon&date=2027-04-11`, ADR 0030), la modification par-dessus
 * l'Objectif lu. Rien n'est enregistré sans clic.
 */
@Component({
  selector: 'pos-formulaire-d-objectif',
  templateUrl: './formulaire-d-objectif.html',
  imports: [DccmFormPage, DccmState, HlmFieldImports, HlmInput],
})
export class FormulaireDObjectif {
  private readonly api = inject(TrainingGoalService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute).snapshot;

  /** L'Objectif modifié ; vide pour une création. */
  protected readonly id = this.route.paramMap.get('id') ?? '';
  protected readonly actuel = this.api.lectureDe(() => this.id);
  private readonly objectif = computed(() =>
    this.actuel.hasValue() ? this.actuel.value() : undefined,
  );
  protected readonly etatDeLaLecture = computed(() =>
    this.id ? stateOf(this.actuel, () => false) : 'ready',
  );

  protected readonly prefill = prefillDepuisRequete(
    zTrainingGoalInput,
    this.route.queryParamMap,
  );

  protected readonly titreSaisi = signal('');
  protected readonly date = signal('');
  protected readonly intention = signal('');

  protected readonly envoi = signal(false);
  protected readonly refus = signal<ApiError | null>(null);
  protected readonly erreurs = computed(() => erreursDeChamp(this.refus()));

  protected readonly titre = this.id
    ? 'Modifier l’objectif'
    : 'Nouvel objectif';
  protected readonly action = this.id ? 'Enregistrer' : 'Créer l’objectif';
  protected readonly fil = computed(() => [
    { label: 'Sport', link: '/sport' },
    { label: 'Objectifs', link: '/sport/objectifs' },
    ...(this.id
      ? [
          {
            label: this.objectif()?.title ?? '…',
            link: `/sport/objectifs/${this.id}`,
          },
        ]
      : []),
    { label: this.id ? 'Modifier' : 'Nouvel objectif' },
  ]);

  constructor() {
    if (!this.id) {
      this.remplir(this.prefill.valeurs);
      return;
    }

    // Une modification part de l'Objectif lu, une seule fois : la requête le
    // complète, et une relecture n'efface pas ce qu'on a saisi depuis.
    let rempli = false;
    effect(() => {
      const objectif = this.objectif();
      if (objectif && !rempli) {
        rempli = true;
        untracked(() =>
          this.remplir({
            title: objectif.title,
            date: objectif.date,
            intent: objectif.intent ?? undefined,
            ...this.prefill.valeurs,
          }),
        );
      }
    });
  }

  protected valeur(evenement: Event): string {
    return (evenement.target as HTMLInputElement).value;
  }

  protected enregistrer(): void {
    const intention = this.intention().trim();
    const saisie: TrainingGoalInput = {
      title: this.titreSaisi(),
      date: this.date(),
      ...(intention ? { intent: intention } : {}),
    };

    this.envoi.set(true);
    this.refus.set(null);
    (this.id
      ? this.api.modifier(this.id, { ...saisie, intent: intention || null })
      : this.api.creer(saisie)
    ).subscribe({
      next: (objectif) => {
        this.envoi.set(false);
        showToast({
          message: this.id
            ? `«\u00a0${objectif.title}\u00a0» est enregistré.`
            : `«\u00a0${objectif.title}\u00a0» est créé.`,
        });
        void this.router.navigate(['/sport/objectifs', objectif.id]);
      },
      error: (refus: ApiError) => {
        this.envoi.set(false);
        this.refus.set(refus);
      },
    });
  }

  protected fermer(): void {
    void this.router.navigate(
      this.id ? ['/sport/objectifs', this.id] : ['/sport/objectifs'],
    );
  }

  private remplir(valeurs: Partial<TrainingGoalInput>): void {
    this.titreSaisi.set(valeurs.title ?? '');
    this.date.set(valeurs.date ?? '');
    this.intention.set(valeurs.intent ?? '');
  }
}
