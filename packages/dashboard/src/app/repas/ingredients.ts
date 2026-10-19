import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matAddOutline,
  matNutritionOutline,
  matSearchOutline,
} from '@ng-icons/material-symbols/outline';
import {
  LIBELLES_DES_ALLERGENES,
  LIBELLES_DES_UNITES,
  type Ingredient,
} from '@personal-os/contracts';
import { HlmBadge } from '@personal-os/ui/badge';
import { HlmButton } from '@personal-os/ui/button';
import { HlmCard } from '@personal-os/ui/card';
import {
  DccmListRow,
  DccmPageHeader,
  DccmState,
  stateOf,
  type DccmCrumb,
} from '@personal-os/ui/dccm';
import { HlmInputImports } from '@personal-os/ui/input';
import { IngredientService } from './ingredient.service';

/** Le fil d'Ariane des écrans du catalogue. */
export const FIL_DES_INGREDIENTS: readonly DccmCrumb[] = [
  { label: 'Repas' },
  { label: 'Ingrédients', link: '/repas/ingredients' },
];

/**
 * Le catalogue d'Ingrédients : tout le catalogue, ou ce que la recherche y
 * trouve. La recherche vit dans l'URL (`?q=`) : un lien la rouvre telle
 * quelle. Une recherche sans résultat propose de créer l'Ingrédient cherché.
 */
@Component({
  imports: [
    RouterLink,
    NgIcon,
    HlmBadge,
    HlmButton,
    HlmCard,
    HlmInputImports,
    DccmListRow,
    DccmPageHeader,
    DccmState,
  ],
  providers: [provideIcons({ matAddOutline, matSearchOutline })],
  templateUrl: './ingredients.html',
})
export class Ingredients {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly fil: readonly DccmCrumb[] = [
    FIL_DES_INGREDIENTS[0],
    { label: 'Ingrédients' },
  ];
  protected readonly iconeVide = matNutritionOutline;

  protected readonly recherche = signal(
    this.route.snapshot.queryParamMap.get('q') ?? '',
  );
  protected readonly catalogue = inject(IngredientService).catalogue(
    this.recherche,
  );
  protected readonly etat = computed(() =>
    stateOf(this.catalogue, (ingredients) => ingredients.length === 0),
  );
  /** Ce que la lecture a rendu ; rien quand elle a échoué (lire `value()` lèverait). */
  protected readonly ingredients = computed(() =>
    this.catalogue.hasValue() ? this.catalogue.value() : [],
  );

  /** Ce que la recherche a tapé, tel qu'on le reprend dans un libellé. */
  protected readonly cherche = computed(() => this.recherche().trim());

  protected readonly titreVide = computed(() =>
    this.cherche()
      ? `Aucun Ingrédient ne correspond à « ${this.cherche()} »`
      : 'Le catalogue est vide',
  );

  protected chercher(evenement: Event): void {
    const texte = (evenement.target as HTMLInputElement).value;
    this.recherche.set(texte);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: texte.trim() || null },
      replaceUrl: true,
    });
  }

  /** L'unité, puis les Allergènes déclarés. */
  protected meta(ingredient: Ingredient): string {
    const allergenes = ingredient.allergens.length
      ? ingredient.allergens
          .map((allergene) => LIBELLES_DES_ALLERGENES[allergene])
          .join(', ')
      : 'Sans allergène';

    return `${LIBELLES_DES_UNITES[ingredient.canonicalUnit]} · ${allergenes}`;
  }
}
