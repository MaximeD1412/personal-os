import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HlmCardImports } from '@personal-os/ui/card';
import {
  DccmPageHeader,
  DccmState,
  stateOf,
  type DccmCrumb,
} from '@personal-os/ui/dccm';
import { HlmTableImports } from '@personal-os/ui/table';
import { portions, quantiteDeLigne } from './quantite';
import { RecipeService } from './recipe.service';
import { FIL_DES_RECETTES } from './recipes';

/**
 * La fiche d'une Recette : ses ingrédients et leurs quantités pour les
 * portions de référence, dans l'unité où on les a saisis, puis ses étapes.
 * La modification et la suppression viennent avec le formulaire (CUISINE-6).
 */
@Component({
  imports: [HlmCardImports, HlmTableImports, DccmPageHeader, DccmState],
  templateUrl: './recipe-detail.html',
})
export class FicheDeRecette {
  protected readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  protected readonly lecture = inject(RecipeService).recette(() => this.id);
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
}
