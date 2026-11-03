import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matSearchOutline } from '@ng-icons/material-symbols/outline';
import {
  zPantryItemAddition,
  type CanonicalUnit,
  type PantryItem,
  type PantryItemInput,
} from '@personal-os/contracts';
import {
  DccmFormPage,
  DccmListRow,
  DccmState,
  stateOf,
} from '@personal-os/ui/dccm';
import { HlmFieldImports } from '@personal-os/ui/field';
import { HlmInputImports } from '@personal-os/ui/input';
import { showToast } from '@personal-os/ui/sonner';
import type { ErreurApi } from '../erreur-api.interceptor';
import { erreursDeChamp, prefillDepuisRequete } from '../formulaire';
import { IngredientService } from './ingredient.service';
import { PantryItemService } from './pantry-item.service';
import { quantiteCanonique, UNITES_CANONIQUES } from './quantite';
import { FIL_DU_STOCK } from './stock';

/** L'Ingrédient retenu : ce qu'il faut pour le nommer et dire son unité. */
interface Choisi {
  id: string;
  displayName: string;
  canonicalUnit: CanonicalUnit;
}

/**
 * L'ajout d'un Ingrédient au Stock domestique : `/repas/stock/nouveau`. On
 * cherche l'Ingrédient au catalogue, puis on dit sa quantité en Unité
 * canonique et, au besoin, sa péremption. Un Ingrédient n'a qu'une ligne :
 * en ajouter un déjà en stock remplace la sienne, ce que la recherche dit.
 * Le formulaire se préremplit par sa requête, aux noms des champs du contrat
 * (`?ingredientId=…&quantity=6&expiresOn=2026-10-30`).
 *
 * Rien ne s'enregistre sans « Ajouter au stock » (ADR 0030).
 */
@Component({
  imports: [
    NgIcon,
    DccmFormPage,
    DccmListRow,
    DccmState,
    HlmFieldImports,
    HlmInputImports,
  ],
  providers: [provideIcons({ matSearchOutline })],
  templateUrl: './stock-form.html',
})
export class FormulaireDeStock {
  private readonly router = inject(Router);
  private readonly service = inject(PantryItemService);
  private readonly ingredients = inject(IngredientService);

  protected readonly prefill = prefillDepuisRequete(
    zPantryItemAddition,
    inject(ActivatedRoute).snapshot.queryParamMap,
  );

  protected readonly ingredientId = signal<string | null>(
    this.prefill.valeurs.ingredientId ?? null,
  );
  protected readonly quantite = signal<number | null>(
    this.prefill.valeurs.quantity ?? null,
  );
  protected readonly peremption = signal<string | null>(
    this.prefill.valeurs.expiresOn ?? null,
  );

  /** Le stock en place, pour dire ce qu'un ajout remplacerait. */
  private readonly stock = this.service.stock();
  private readonly enStock = computed(
    () =>
      new Map<string, PantryItem>(
        (this.stock.hasValue() ? this.stock.value() : []).map((ligne) => [
          ligne.ingredient.id,
          ligne,
        ]),
      ),
  );

  protected readonly recherche = signal('');
  protected readonly catalogue = this.ingredients.catalogue(this.recherche);
  /** Une lecture échouée dit le `message` de l'API et propose « Réessayer ». */
  protected readonly etatDuCatalogue = computed(() =>
    stateOf(this.catalogue, (ingredients) => ingredients.length === 0),
  );
  protected readonly trouves = computed(() =>
    this.catalogue.hasValue() ? this.catalogue.value() : [],
  );
  /** L'Ingrédient du lien, lu pour le nommer. */
  private readonly duLien = this.ingredients.ingredient(
    () => this.prefill.valeurs.ingredientId ?? null,
  );
  /** L'Ingrédient retenu, une fois la recherche passée à autre chose. */
  private readonly retenu = signal<Choisi | null>(null);
  protected readonly choisi = computed<Choisi | null>(() => {
    const id = this.ingredientId();
    if (!id) return null;
    const lu = this.duLien.hasValue() ? this.duLien.value() : undefined;
    return (
      this.trouves().find((ingredient) => ingredient.id === id) ??
      (this.retenu()?.id === id ? this.retenu() : null) ??
      (lu?.id === id ? lu : null)
    );
  });
  protected readonly unite = computed(() => {
    const choisi = this.choisi();
    return choisi ? UNITES_CANONIQUES[choisi.canonicalUnit] : null;
  });
  /** La ligne que l'ajout remplacera, quand l'Ingrédient est déjà en stock. */
  protected readonly enPlace = computed(() => {
    const id = this.ingredientId();
    const ligne = id ? this.enStock().get(id) : undefined;
    return ligne ? this.enStockDe(ligne) : null;
  });

  protected readonly envoi = signal(false);
  protected readonly refus = signal<ErreurApi | null>(null);
  protected readonly erreurs = computed(() => erreursDeChamp(this.refus()));

  protected readonly fil = [
    ...FIL_DU_STOCK,
    { label: 'Ajouter un ingrédient' },
  ];

  protected chercher(evenement: Event): void {
    this.recherche.set((evenement.target as HTMLInputElement).value);
  }

  protected choisir(ingredient: Choisi): void {
    this.ingredientId.set(ingredient.id);
    this.retenu.set(ingredient);
  }

  /** « En stock : 1 000 ml », pour un Ingrédient qui a déjà sa ligne. */
  protected dejaEnStock(ingredientId: string): string | undefined {
    const ligne = this.enStock().get(ingredientId);
    return ligne ? this.enStockDe(ligne) : undefined;
  }

  protected saisirLaQuantite(evenement: Event): void {
    const champ = evenement.target as HTMLInputElement;
    this.quantite.set(
      champ.value === '' || Number.isNaN(champ.valueAsNumber)
        ? null
        : champ.valueAsNumber,
    );
  }

  protected saisirLaPeremption(evenement: Event): void {
    this.peremption.set((evenement.target as HTMLInputElement).value || null);
  }

  protected enregistrer(): void {
    const id = this.ingredientId();
    if (!id) return;
    const nom = this.choisi()?.displayName;
    // Une quantité vide part telle quelle : l'API dit ce qui ne va pas.
    const saisie = {
      quantity: this.quantite(),
      expiresOn: this.peremption(),
    } as PantryItemInput;

    this.envoi.set(true);
    this.refus.set(null);
    this.service.corriger(id, saisie).subscribe({
      next: (ligne) => {
        this.envoi.set(false);
        showToast({
          message: `«\u00a0${nom ?? ligne.ingredient.displayName}\u00a0» : ${quantiteCanonique(ligne.quantity, ligne.ingredient.canonicalUnit)} en stock.`,
        });
        void this.router.navigate(['/repas/stock']);
      },
      error: (erreur: ErreurApi) => {
        this.envoi.set(false);
        this.refus.set(erreur);
      },
    });
  }

  protected fermer(): void {
    void this.router.navigate(['/repas/stock']);
  }

  private enStockDe(ligne: PantryItem): string {
    return `En stock\u00a0: ${quantiteCanonique(ligne.quantity, ligne.ingredient.canonicalUnit)}`;
  }
}
