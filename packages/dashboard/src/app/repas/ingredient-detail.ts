import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matEditOutline } from '@ng-icons/material-symbols/outline';
import {
  ALLERGENES,
  LIBELLES_DES_ALLERGENES,
  LIBELLES_DES_UNITES,
  UNITES_AVEC_POIDS_A_LA_PIECE,
} from '@personal-os/contracts';
import { HlmBadge } from '@personal-os/ui/badge';
import { HlmButton } from '@personal-os/ui/button';
import { HlmCardImports } from '@personal-os/ui/card';
import {
  DccmPageHeader,
  DccmState,
  stateOf,
  type DccmCrumb,
} from '@personal-os/ui/dccm';
import { IngredientService } from './ingredient.service';
import { FIL_DES_INGREDIENTS } from './ingredients';

/**
 * La fiche d'un Ingrédient : son unité canonique, son poids moyen à la pièce,
 * ses Allergènes et sa conservation. « Modifier » mène au formulaire ; il n'y a pas de
 * suppression, un doublon se fusionne (CUISINE-4).
 */
@Component({
  imports: [
    RouterLink,
    NgIcon,
    HlmBadge,
    HlmButton,
    HlmCardImports,
    DccmPageHeader,
    DccmState,
  ],
  providers: [provideIcons({ matEditOutline })],
  templateUrl: './ingredient-detail.html',
})
export class FicheDIngredient {
  protected readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  protected readonly lecture = inject(IngredientService).ingredient(
    () => this.id,
  );
  protected readonly etat = computed(() => stateOf(this.lecture, () => false));
  /** L'Ingrédient lu ; rien quand la lecture a échoué (lire `value()` lèverait). */
  protected readonly ingredient = computed(() =>
    this.lecture.hasValue() ? this.lecture.value() : undefined,
  );

  protected readonly titre = computed(
    () => this.ingredient()?.displayName ?? 'Ingrédient',
  );
  protected readonly fil = computed((): DccmCrumb[] => [
    ...FIL_DES_INGREDIENTS,
    { label: this.titre() },
  ]);

  protected readonly unite = computed(() => {
    const ingredient = this.ingredient();
    return ingredient ? LIBELLES_DES_UNITES[ingredient.canonicalUnit] : '';
  });

  /** Le poids à la pièce ne se montre qu'en grammes ou en pièces, même vide. */
  protected readonly avecPoidsALaPiece = computed(() => {
    const ingredient = this.ingredient();
    return (
      !!ingredient &&
      UNITES_AVEC_POIDS_A_LA_PIECE.includes(ingredient.canonicalUnit)
    );
  });

  /** Les Allergènes déclarés, dans l'ordre réglementaire. */
  protected readonly allergenes = computed(() => {
    const declares = this.ingredient()?.allergens ?? [];
    return ALLERGENES.filter((famille) => declares.includes(famille)).map(
      (famille) => LIBELLES_DES_ALLERGENES[famille],
    );
  });
}
