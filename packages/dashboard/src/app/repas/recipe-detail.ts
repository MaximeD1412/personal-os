import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { matStarOutline } from '@ng-icons/material-symbols/outline';
import { HlmAlertImports } from '@personal-os/ui/alert';
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
import { HlmTableImports } from '@personal-os/ui/table';
import type { ErreurApi } from '../erreur-api.interceptor';
import { portions, quantiteDeLigne } from './quantite';
import { RecipeService } from './recipe.service';
import { FIL_DES_RECETTES } from './recipes';
import { confirmerLaGarde } from './keep-confirmation';

/**
 * La fiche d'une Recette : ses ingrédients et leurs quantités pour les
 * portions de référence, dans l'unité où on les a saisis, puis ses étapes.
 * La modification et la suppression viennent avec le formulaire (CUISINE-6).
 *
 * Une recette générée qu'on n'a pas gardée se lit ici depuis le repas qui la
 * cuisine : « Garder la recette » la fait entrer dans « Mes recettes », et la
 * génération la proposera en priorité.
 */
@Component({
  imports: [
    NgIcon,
    HlmAlertImports,
    HlmButton,
    HlmCardImports,
    HlmTableImports,
    DccmPageHeader,
    DccmState,
  ],
  templateUrl: './recipe-detail.html',
})
export class FicheDeRecette {
  private readonly service = inject(RecipeService);
  private readonly confirmation = inject(DccmConfirm);
  protected readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  protected readonly lecture = this.service.recette(() => this.id);
  protected readonly iconeGarder = matStarOutline;
  protected readonly etat = computed(() => stateOf(this.lecture, () => false));
  /** La recette lue ; rien quand la lecture a échoué (lire `value()` lèverait). */
  protected readonly recette = computed(() =>
    this.lecture.hasValue() ? this.lecture.value() : undefined,
  );

  protected readonly titre = computed(() => this.recette()?.title ?? 'Recette');
  protected readonly fil = computed((): DccmCrumb[] => [
    ...FIL_DES_RECETTES,
    { label: this.titre() },
  ]);
  protected readonly pourCombien = computed(() => {
    const recette = this.recette();
    return recette ? `Pour ${portions(recette.servings)}` : '';
  });

  protected readonly quantite = quantiteDeLigne;

  /** La garde, le temps de la requête ; son refus, en bandeau. */
  protected readonly enCours = signal(false);
  protected readonly refus = signal<ErreurApi | null>(null);

  /** Garder est une transition, sans retour : elle se confirme. */
  protected async garder(): Promise<void> {
    const recette = this.recette();
    if (!recette) return;
    if (!(await confirmerLaGarde(this.confirmation, recette.title))) return;

    this.enCours.set(true);
    this.refus.set(null);
    this.service.garder(recette.id).subscribe({
      next: (gardee) => {
        this.enCours.set(false);
        this.lecture.set(gardee);
        showToast({
          tone: 'success',
          message: `«\u00a0${gardee.title}\u00a0» rejoint vos recettes.`,
        });
      },
      error: (erreur: ErreurApi) => {
        this.enCours.set(false);
        this.refus.set(erreur);
      },
    });
  }
}
