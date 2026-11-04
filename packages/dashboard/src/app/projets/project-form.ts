import {
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matAddLinkOutline,
  matCloseOutline,
} from '@ng-icons/material-symbols/outline';
import {
  zProjectInput,
  type Project,
  type ProjectInput,
  type ProjectLink,
} from '@personal-os/contracts';
import { HlmButton } from '@personal-os/ui/button';
import { DccmFormPage, DccmState, stateOf } from '@personal-os/ui/dccm';
import { HlmFieldImports } from '@personal-os/ui/field';
import { HlmInput } from '@personal-os/ui/input';
import { showToast } from '@personal-os/ui/sonner';
import type { ErreurApi } from '../erreur-api.interceptor';
import { erreursDeChamp, prefillDepuisRequete } from '../formulaire';
import { ProjectService } from './project.service';
import { FIL_DES_PROJETS } from './projects';

/**
 * La saisie d'un Projet : `/projets/nouveau` pour une création,
 * `/projets/:id/modifier` pour une modification. Les deux se préremplissent
 * par leur requête, aux noms des champs du contrat
 * (`?title=Atelier%20de%20reliure&notes=…`) ; une modification part du
 * Projet, que la requête complète. Les liens se saisissent ici, pas par l'URL.
 *
 * Rien ne s'enregistre sans « Créer » ou « Enregistrer » (ADR 0030).
 */
@Component({
  imports: [
    NgIcon,
    DccmFormPage,
    DccmState,
    HlmButton,
    HlmFieldImports,
    HlmInput,
  ],
  providers: [provideIcons({ matAddLinkOutline, matCloseOutline })],
  templateUrl: './project-form.html',
})
export class FormulaireDeProjet {
  private readonly router = inject(Router);
  private readonly projets = inject(ProjectService);
  private readonly route = inject(ActivatedRoute).snapshot;

  /** Le Projet modifié ; vide pour une création. */
  protected readonly id = this.route.paramMap.get('id');
  protected readonly actuel = this.projets.projet(() => this.id);
  /** Le Projet lu ; rien quand la lecture a échoué (lire `value()` lèverait). */
  private readonly projet = computed(() =>
    this.actuel.hasValue() ? this.actuel.value() : undefined,
  );
  protected readonly etatDeLaLecture = computed(() =>
    this.id ? stateOf(this.actuel, () => false) : 'ready',
  );

  protected readonly prefill = prefillDepuisRequete(
    zProjectInput,
    this.route.queryParamMap,
  );

  protected readonly titreSaisi = signal('');
  protected readonly notes = signal('');
  protected readonly liens = signal<readonly ProjectLink[]>([]);

  protected readonly envoi = signal(false);
  protected readonly refus = signal<ErreurApi | null>(null);
  protected readonly erreurs = computed(() => erreursDeChamp(this.refus()));

  protected readonly titre = this.id ? 'Modifier le projet' : 'Nouveau projet';
  protected readonly action = this.id ? 'Enregistrer' : 'Créer le projet';
  protected readonly fil = computed(() => [
    ...FIL_DES_PROJETS,
    ...(this.id
      ? [{ label: this.projet()?.title ?? '…', link: `/projets/${this.id}` }]
      : []),
    { label: this.id ? 'Modifier' : 'Nouveau projet' },
  ]);

  constructor() {
    if (!this.id) {
      this.remplir(this.prefill.valeurs);
      return;
    }

    // Une modification part du Projet lu, une seule fois : la requête le
    // complète, et une relecture n'efface pas ce qu'on a saisi depuis.
    let rempli = false;
    effect(() => {
      const projet = this.projet();
      if (projet && !rempli) {
        rempli = true;
        untracked(() => this.remplir({ ...projet, ...this.prefill.valeurs }));
      }
    });
  }

  protected valeur(evenement: Event): string {
    return (evenement.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected ajouterUnLien(): void {
    this.liens.update((liens) => [...liens, { label: '', url: '' }]);
  }

  protected modifierLeLien(
    indice: number,
    changement: Partial<ProjectLink>,
  ): void {
    this.liens.update((liens) =>
      liens.map((lien, i) =>
        i === indice ? { ...lien, ...changement } : lien,
      ),
    );
  }

  protected retirerLeLien(indice: number): void {
    this.liens.update((liens) => liens.filter((_, i) => i !== indice));
  }

  protected enregistrer(): void {
    const saisie: ProjectInput = {
      title: this.titreSaisi(),
      notes: this.notes(),
      links: [...this.liens()],
    };

    this.envoi.set(true);
    this.refus.set(null);
    (this.id
      ? this.projets.modifier(this.id, saisie)
      : this.projets.creer(saisie)
    ).subscribe({
      next: (projet) => {
        this.envoi.set(false);
        showToast({
          message: this.id
            ? `«\u00a0${projet.title}\u00a0» est enregistré.`
            : `«\u00a0${projet.title}\u00a0» est créé.`,
        });
        void this.router.navigate(['/projets', projet.id]);
      },
      error: (erreur: ErreurApi) => {
        this.envoi.set(false);
        this.refus.set(erreur);
      },
    });
  }

  protected fermer(): void {
    void this.router.navigate(this.id ? ['/projets', this.id] : ['/projets']);
  }

  private remplir(valeurs: Partial<Project & ProjectInput>): void {
    if (valeurs.title !== undefined) this.titreSaisi.set(valeurs.title);
    if (valeurs.notes !== undefined) this.notes.set(valeurs.notes);
    if (valeurs.links !== undefined) this.liens.set(valeurs.links);
  }
}
