import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matArrowDownwardOutline,
  matSearchOutline,
} from '@ng-icons/material-symbols/outline';
import {
  zIngredientMergeInput,
  type CanonicalUnit,
  type Ingredient,
} from '@personal-os/contracts';
import { HlmBadge } from '@personal-os/ui/badge';
import { HlmCard } from '@personal-os/ui/card';
import {
  DccmConfirm,
  DccmFormPage,
  DccmListRow,
  DccmState,
  stateOf,
  type DccmCrumb,
} from '@personal-os/ui/dccm';
import { HlmFieldImports } from '@personal-os/ui/field';
import { HlmInputImports } from '@personal-os/ui/input';
import { showToast } from '@personal-os/ui/sonner';
import type { ErreurApi } from '../erreur-api.interceptor';
import { erreursDeChamp, prefillDepuisRequete } from '../formulaire';
import { IngredientService } from './ingredient.service';
import { FIL_DES_INGREDIENTS } from './ingredients';

/** L'unité dans une phrase : « compté en grammes ». */
const EN_TOUTES_LETTRES: Readonly<Record<CanonicalUnit, string>> = {
  GRAM: 'grammes',
  MILLILITER: 'millilitres',
  PIECE: 'pièces',
};

/**
 * La fusion d'un doublon : `/repas/ingredients/:id/fusionner`. L'Ingrédient de
 * l'URL est le doublon ; on cherche au catalogue celui qui le remplace, compté
 * dans la même Unité canonique. Il en reprend tout (recettes, stock, courses,
 * repas cuisinés, Produits, Préférences), et le nom du doublon lui devient un
 * Alias. Le formulaire se préremplit par sa requête (`?intoId=…`).
 *
 * Rien ne s'enregistre sans « Fusionner », puis la confirmation : le doublon
 * disparaît du catalogue (ADR 0030).
 */
@Component({
  imports: [
    NgIcon,
    HlmBadge,
    HlmCard,
    DccmFormPage,
    DccmListRow,
    DccmState,
    HlmFieldImports,
    HlmInputImports,
  ],
  providers: [provideIcons({ matArrowDownwardOutline, matSearchOutline })],
  templateUrl: './ingredient-merge.html',
})
export class FusionDIngredient {
  private readonly router = inject(Router);
  private readonly service = inject(IngredientService);
  private readonly confirmation = inject(DccmConfirm);

  private readonly route = inject(ActivatedRoute).snapshot;
  protected readonly id = this.route.paramMap.get('id') ?? '';
  protected readonly prefill = prefillDepuisRequete(
    zIngredientMergeInput,
    this.route.queryParamMap,
  );

  /** Le doublon, qui disparaîtra. */
  protected readonly lecture = this.service.ingredient(() => this.id);
  protected readonly doublon = computed(() =>
    this.lecture.hasValue() ? this.lecture.value() : undefined,
  );

  protected readonly intoId = signal<string | null>(
    this.prefill.valeurs.intoId ?? null,
  );

  protected readonly recherche = signal('');
  protected readonly catalogue = this.service.catalogue(this.recherche);
  /**
   * Les Ingrédients qui peuvent l'absorber : tous ceux du catalogue comptés
   * dans son unité, sauf lui-même.
   */
  protected readonly trouves = computed(() => {
    const doublon = this.doublon();
    const lus = this.catalogue.hasValue() ? this.catalogue.value() : [];
    return doublon
      ? lus.filter(
          ({ id, canonicalUnit }) =>
            id !== doublon.id && canonicalUnit === doublon.canonicalUnit,
        )
      : [];
  });
  /** Une lecture échouée dit le `message` de l'API et propose « Réessayer ». */
  protected readonly etatDuCatalogue = computed(() =>
    stateOf(this.catalogue, () => this.trouves().length === 0),
  );
  /** L'Ingrédient du lien, lu pour le nommer. */
  private readonly duLien = this.service.ingredient(
    () => this.prefill.valeurs.intoId ?? null,
  );
  /** L'Ingrédient retenu, une fois la recherche passée à autre chose. */
  private readonly retenu = signal<Ingredient | null>(null);
  protected readonly conserve = computed<Ingredient | null>(() => {
    const id = this.intoId();
    if (!id) return null;
    const lu = this.duLien.hasValue() ? this.duLien.value() : undefined;
    return (
      this.trouves().find((ingredient) => ingredient.id === id) ??
      (this.retenu()?.id === id ? this.retenu() : null) ??
      (lu?.id === id ? lu : null)
    );
  });

  protected readonly unite = computed(() => {
    const doublon = this.doublon();
    return doublon ? EN_TOUTES_LETTRES[doublon.canonicalUnit] : '';
  });

  protected readonly envoi = signal(false);
  protected readonly refus = signal<ErreurApi | null>(null);
  protected readonly erreurs = computed(() => erreursDeChamp(this.refus()));

  protected readonly fil = computed((): DccmCrumb[] => [
    ...FIL_DES_INGREDIENTS,
    {
      label: this.doublon()?.displayName ?? 'Ingrédient',
      link: `/repas/ingredients/${this.id}`,
    },
    { label: 'Fusionner' },
  ]);

  protected chercher(evenement: Event): void {
    this.recherche.set((evenement.target as HTMLInputElement).value);
  }

  protected choisir(ingredient: Ingredient): void {
    this.intoId.set(ingredient.id);
    this.retenu.set(ingredient);
  }

  protected async fusionner(): Promise<void> {
    const intoId = this.intoId();
    const doublon = this.doublon();
    if (!intoId || !doublon) return;
    const conserve = this.conserve()?.displayName ?? 'l’Ingrédient choisi';

    const confirme = await this.confirmation.confirm({
      title: `Fusionner «\u00a0${doublon.displayName}\u00a0» avec «\u00a0${conserve}\u00a0» ?`,
      description: `«\u00a0${doublon.displayName}\u00a0» disparaît du catalogue : ses recettes, son stock, ses courses, ses Produits et ses Préférences passent à «\u00a0${conserve}\u00a0», et son nom en devient un Alias.`,
      confirmLabel: 'Fusionner les ingrédients',
      destructive: true,
    });
    if (!confirme) return;

    this.envoi.set(true);
    this.refus.set(null);
    this.service.fusionner(doublon.id, { intoId }).subscribe({
      next: (ingredient) => {
        this.envoi.set(false);
        showToast({
          message: `«\u00a0${doublon.displayName}\u00a0» est fusionné dans «\u00a0${ingredient.displayName}\u00a0».`,
        });
        void this.router.navigate(['/repas/ingredients', ingredient.id]);
      },
      error: (erreur: ErreurApi) => {
        this.envoi.set(false);
        this.refus.set(erreur);
      },
    });
  }

  protected fermer(): void {
    void this.router.navigate(['/repas/ingredients', this.id]);
  }
}
