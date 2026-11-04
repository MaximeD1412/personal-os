import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matSearchOutline } from '@ng-icons/material-symbols/outline';
import {
  ALLERGENES,
  FOOD_PREFERENCE_KINDS,
  FOOD_PREFERENCE_TARGETS,
  LIBELLES_DES_ALLERGENES,
  LIBELLES_DES_PREFERENCES,
  zFoodPreferenceInput,
  type Allergen,
  type FoodPreference,
  type FoodPreferenceInput,
  type FoodPreferenceKind,
  type FoodPreferenceTarget,
} from '@personal-os/contracts';
import {
  DccmFormPage,
  DccmListRow,
  DccmState,
  stateOf,
} from '@personal-os/ui/dccm';
import { HlmFieldImports } from '@personal-os/ui/field';
import { HlmInputImports } from '@personal-os/ui/input';
import { HlmSelectImports } from '@personal-os/ui/select';
import { showToast } from '@personal-os/ui/sonner';
import { HlmToggleGroupImports } from '@personal-os/ui/toggle-group';
import type { ErreurApi } from '../erreur-api.interceptor';
import { erreursDeChamp, prefillDepuisRequete } from '../formulaire';
import { HouseholdService } from '../household.service';
import { IngredientService } from '../repas/ingredient.service';
import { FoodPreferenceService } from './food-preference.service';
import { FIL_DES_PREFERENCES } from './preferences';

const LIBELLES_DES_CIBLES: Readonly<Record<FoodPreferenceTarget, string>> = {
  ALLERGEN: 'Allergène',
  INGREDIENT: 'Ingrédient',
};

/**
 * L'ajout d'une Préférence alimentaire : `/foyer/preferences/nouvelle`, pour
 * un Compte du Foyer. Elle vise un Allergène de la liste fermée, ou un
 * Ingrédient du catalogue, cherché par son nom. Le formulaire se préremplit
 * par sa requête, aux noms des champs du contrat
 * (`?userId=…&kind=ALLERGY&target=ALLERGEN&allergen=TREE_NUTS`) ; un
 * `allergen` ou un `ingredientId` seul dit déjà la cible.
 *
 * Rien ne s'enregistre sans « Ajouter » (ADR 0030).
 */
@Component({
  imports: [
    NgIcon,
    DccmFormPage,
    DccmListRow,
    DccmState,
    HlmFieldImports,
    HlmInputImports,
    HlmSelectImports,
    HlmToggleGroupImports,
  ],
  providers: [provideIcons({ matSearchOutline })],
  templateUrl: './preference-form.html',
})
export class FormulaireDePreference {
  private readonly router = inject(Router);
  private readonly service = inject(FoodPreferenceService);
  private readonly ingredients = inject(IngredientService);

  protected readonly prefill = prefillDepuisRequete(
    zFoodPreferenceInput,
    inject(ActivatedRoute).snapshot.queryParamMap,
  );

  protected readonly foyer = inject(HouseholdService).foyer();
  protected readonly etatDuFoyer = computed(() =>
    stateOf(this.foyer, () => false),
  );
  protected readonly membres = computed(() =>
    this.foyer.hasValue() ? (this.foyer.value()?.members ?? []) : [],
  );

  protected readonly compte = signal<string | null>(
    this.prefill.valeurs.userId ?? null,
  );
  protected readonly type = signal<FoodPreferenceKind | null>(
    this.prefill.valeurs.kind ?? null,
  );
  protected readonly cible = signal<FoodPreferenceTarget>(
    this.prefill.valeurs.target ??
      (this.prefill.valeurs.ingredientId !== undefined
        ? 'INGREDIENT'
        : 'ALLERGEN'),
  );
  protected readonly allergene = signal<Allergen | null>(
    this.prefill.valeurs.allergen ?? null,
  );
  protected readonly ingredientId = signal<string | null>(
    this.prefill.valeurs.ingredientId ?? null,
  );

  protected readonly recherche = signal('');
  /** Le catalogue, lu seulement quand la Préférence vise un Ingrédient. */
  protected readonly catalogue = this.ingredients.catalogue(
    this.recherche,
    () => this.cible() === 'INGREDIENT',
  );
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
  /** Le nom de l'Ingrédient retenu, une fois la recherche passée à autre chose. */
  private readonly nomRetenu = signal<string | null>(null);
  protected readonly ingredientChoisi = computed(() => {
    const id = this.ingredientId();
    if (!id) return null;
    const trouve = this.trouves().find((ingredient) => ingredient.id === id);
    const lu = this.duLien.hasValue() ? this.duLien.value() : undefined;
    return (
      trouve?.displayName ??
      this.nomRetenu() ??
      (lu?.id === id ? lu.displayName : null)
    );
  });

  protected readonly envoi = signal(false);
  protected readonly refus = signal<ErreurApi | null>(null);
  protected readonly erreurs = computed(() => erreursDeChamp(this.refus()));

  protected readonly types = FOOD_PREFERENCE_KINDS.map((valeur) => ({
    valeur,
    libelle: LIBELLES_DES_PREFERENCES[valeur],
  }));
  protected readonly cibles = FOOD_PREFERENCE_TARGETS.map((valeur) => ({
    valeur,
    libelle: LIBELLES_DES_CIBLES[valeur],
  }));
  protected readonly familles = ALLERGENES.map((valeur) => ({
    valeur,
    libelle: LIBELLES_DES_ALLERGENES[valeur],
  }));

  protected readonly fil = [
    ...FIL_DES_PREFERENCES,
    { label: 'Nouvelle préférence' },
  ];

  /* `hlm-select` appelle `itemToString` détaché de l'instance : une flèche. */
  protected readonly nomDeLAllergene = (
    allergene: Allergen | null | undefined,
  ): string => (allergene ? LIBELLES_DES_ALLERGENES[allergene] : '');

  constructor() {
    // Un Foyer d'un seul Compte n'a pas de choix à faire.
    effect(() => {
      const membres = this.membres();
      if (membres.length === 1 && this.compte() === null) {
        this.compte.set(membres[0].id);
      }
    });
  }

  protected choisirLeCompte(valeur: unknown): void {
    if (this.membres().some((membre) => membre.id === valeur)) {
      this.compte.set(valeur as string);
    }
  }

  protected choisirLeType(valeur: unknown): void {
    if (FOOD_PREFERENCE_KINDS.includes(valeur as FoodPreferenceKind)) {
      this.type.set(valeur as FoodPreferenceKind);
    }
  }

  protected choisirLaCible(valeur: unknown): void {
    if (FOOD_PREFERENCE_TARGETS.includes(valeur as FoodPreferenceTarget)) {
      this.cible.set(valeur as FoodPreferenceTarget);
    }
  }

  protected choisirLAllergene(valeur: unknown): void {
    this.allergene.set(
      ALLERGENES.includes(valeur as Allergen) ? (valeur as Allergen) : null,
    );
  }

  protected chercher(evenement: Event): void {
    this.recherche.set((evenement.target as HTMLInputElement).value);
  }

  protected choisirLIngredient(id: string, nom: string): void {
    this.ingredientId.set(id);
    this.nomRetenu.set(nom);
  }

  protected enregistrer(): void {
    const commun = {
      userId: this.compte() as string,
      kind: this.type() as FoodPreferenceKind,
    };
    // La saisie ne nomme que la cible choisie : l'autre champ n'est pas envoyé.
    const saisie: FoodPreferenceInput =
      this.cible() === 'ALLERGEN'
        ? {
            ...commun,
            target: 'ALLERGEN',
            allergen: this.allergene() as Allergen,
          }
        : {
            ...commun,
            target: 'INGREDIENT',
            ingredientId: this.ingredientId() as string,
          };

    this.envoi.set(true);
    this.refus.set(null);
    this.service.creer(saisie).subscribe({
      next: (preference) => {
        this.envoi.set(false);
        showToast({ message: this.confirmation(preference) });
        void this.router.navigate(['/foyer/preferences']);
      },
      error: (erreur: ErreurApi) => {
        this.envoi.set(false);
        this.refus.set(erreur);
      },
    });
  }

  protected fermer(): void {
    void this.router.navigate(['/foyer/preferences']);
  }

  private confirmation(preference: FoodPreference): string {
    const libelle =
      preference.target === 'ALLERGEN'
        ? LIBELLES_DES_ALLERGENES[preference.allergen]
        : preference.ingredientDisplayName;
    const membre = this.membres().find(({ id }) => id === preference.userId);
    const pour = membre ? ` pour ${membre.displayName}` : '';
    return `«\u00a0${libelle}\u00a0» : ${LIBELLES_DES_PREFERENCES[preference.kind].toLowerCase()}${pour}.`;
  }
}
