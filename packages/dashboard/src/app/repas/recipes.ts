import { Component, computed, inject, linkedSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matMenuBookOutline,
  matSearchOutline,
} from '@ng-icons/material-symbols/outline';
import type { Recipe } from '@personal-os/contracts';
import { HlmCard } from '@personal-os/ui/card';
import {
  DccmListRow,
  DccmPageHeader,
  DccmState,
  stateOf,
  type DccmCrumb,
} from '@personal-os/ui/dccm';
import { HlmInputImports } from '@personal-os/ui/input';
import { portions } from './quantite';
import { RecipeService } from './recipe.service';

/** Le fil d'Ariane des écrans de recettes. */
export const FIL_DES_RECETTES: readonly DccmCrumb[] = [
  { label: 'Repas' },
  { label: 'Recettes', link: '/repas/recettes' },
];

/**
 * Les Recettes du Foyer : toutes, ou celles dont le titre contient chaque mot
 * de la recherche. La recherche vit dans l'URL (`?q=`) : un lien la rouvre
 * telle quelle. La saisie d'une recette vient avec son formulaire
 * (CUISINE-6) : d'ici à là, la liste ne propose pas d'en créer.
 */
@Component({
  imports: [
    RouterLink,
    NgIcon,
    HlmCard,
    HlmInputImports,
    DccmListRow,
    DccmPageHeader,
    DccmState,
  ],
  providers: [provideIcons({ matSearchOutline })],
  templateUrl: './recipes.html',
})
export class Recettes {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly fil: readonly DccmCrumb[] = [
    FIL_DES_RECETTES[0],
    { label: 'Recettes' },
  ];
  protected readonly iconeVide = matMenuBookOutline;

  /** La recherche de l'URL : un lien vers l'écran déjà ouvert la change aussi. */
  private readonly rechercheDeLUrl = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('q') ?? '')),
    { initialValue: this.route.snapshot.queryParamMap.get('q') ?? '' },
  );
  /**
   * Le champ suit la frappe, et l'URL quand elle dit autre chose. L'URL ne
   * retient que la recherche nettoyée : quand elle s'accorde avec la frappe,
   * le champ garde l'espace qu'on vient de taper.
   */
  protected readonly recherche = linkedSignal<string, string>({
    source: this.rechercheDeLUrl,
    computation: (q, precedente) =>
      precedente && precedente.value.trim() === q ? precedente.value : q,
  });
  protected readonly lecture = inject(RecipeService).recettes(this.recherche);
  protected readonly etat = computed(() =>
    stateOf(this.lecture, (recettes) => recettes.length === 0),
  );
  /** Ce que la lecture a rendu ; rien quand elle a échoué (lire `value()` lèverait). */
  protected readonly recettes = computed(() =>
    this.lecture.hasValue() ? this.lecture.value() : [],
  );

  protected readonly titreVide = computed(() => {
    const cherche = this.recherche().trim();
    return cherche
      ? `Aucune recette ne correspond à «\u00a0${cherche}\u00a0»`
      : "Le Foyer n'a encore aucune recette";
  });

  protected chercher(evenement: Event): void {
    const texte = (evenement.target as HTMLInputElement).value;
    this.recherche.set(texte);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: texte.trim() || null },
      replaceUrl: true,
    });
  }

  /** Les portions de référence, puis le nombre d'ingrédients. */
  protected meta(recette: Recipe): string {
    const ingredients = recette.lines.length;
    return `${portions(recette.servings)} · ${ingredients}\u00a0${
      ingredients >= 2 ? 'ingrédients' : 'ingrédient'
    }`;
  }
}
