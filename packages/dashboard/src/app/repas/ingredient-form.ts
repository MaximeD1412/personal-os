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
  ALLERGENES,
  LIBELLES_DES_ALLERGENES,
  LIBELLES_DES_UNITES,
  UNITES_AVEC_POIDS_A_LA_PIECE,
  UNITES_CANONIQUES,
  zIngredientInput,
  type Allergen,
  type CanonicalUnit,
  type Ingredient,
  type IngredientInput,
} from '@personal-os/contracts';
import { HlmCheckbox } from '@personal-os/ui/checkbox';
import { DccmFormPage, DccmState, stateOf } from '@personal-os/ui/dccm';
import { HlmFieldImports } from '@personal-os/ui/field';
import { HlmInput } from '@personal-os/ui/input';
import { showToast } from '@personal-os/ui/sonner';
import { HlmSwitch } from '@personal-os/ui/switch';
import { HlmToggleGroupImports } from '@personal-os/ui/toggle-group';
import type { ErreurApi } from '../erreur-api.interceptor';
import { erreursDeChamp, prefillDepuisRequete } from '../formulaire';
import { IngredientService } from './ingredient.service';
import { FIL_DES_INGREDIENTS } from './ingredients';

/**
 * La saisie d'un Ingrédient : `/repas/ingredients/nouveau` pour une création,
 * `/repas/ingredients/:id/modifier` pour une modification. Les deux se
 * préremplissent par leur requête, aux noms des champs du contrat
 * (`?displayName=Poireau&canonicalUnit=GRAM&perishable=true`) ; une
 * modification part de l'Ingrédient, que la requête complète.
 *
 * Rien ne s'enregistre sans « Créer » ou « Enregistrer » (ADR 0030).
 */
@Component({
  imports: [
    DccmFormPage,
    DccmState,
    HlmCheckbox,
    HlmFieldImports,
    HlmInput,
    HlmSwitch,
    HlmToggleGroupImports,
  ],
  templateUrl: './ingredient-form.html',
})
export class FormulaireDIngredient {
  private readonly router = inject(Router);
  private readonly ingredients = inject(IngredientService);
  private readonly route = inject(ActivatedRoute).snapshot;

  /** L'Ingrédient modifié ; vide pour une création. */
  protected readonly id = this.route.paramMap.get('id');
  protected readonly actuel = this.ingredients.ingredient(() => this.id);
  /** L'Ingrédient lu ; rien quand la lecture a échoué (lire `value()` lèverait). */
  private readonly ingredient = computed(() =>
    this.actuel.hasValue() ? this.actuel.value() : undefined,
  );
  protected readonly etatDeLaLecture = computed(() =>
    this.id ? stateOf(this.actuel, () => false) : 'ready',
  );

  protected readonly prefill = prefillDepuisRequete(
    zIngredientInput,
    this.route.queryParamMap,
  );

  protected readonly libelle = signal('');
  protected readonly unite = signal<CanonicalUnit | null>(null);
  protected readonly poidsALaPiece = signal<number | null>(null);
  protected readonly allergenes = signal<readonly Allergen[]>([]);
  protected readonly perissable = signal(false);

  protected readonly envoi = signal(false);
  protected readonly refus = signal<ErreurApi | null>(null);
  protected readonly erreurs = computed(() => erreursDeChamp(this.refus()));

  protected readonly unites = UNITES_CANONIQUES.map((valeur) => ({
    valeur,
    libelle: LIBELLES_DES_UNITES[valeur],
  }));
  protected readonly familles = ALLERGENES.map((valeur) => ({
    valeur,
    libelle: LIBELLES_DES_ALLERGENES[valeur],
  }));

  /** Le poids à la pièce ne se demande qu'en grammes ou en pièces. */
  protected readonly avecPoidsALaPiece = computed(() => {
    const unite = this.unite();
    return unite !== null && UNITES_AVEC_POIDS_A_LA_PIECE.includes(unite);
  });

  protected readonly titre = this.id
    ? "Modifier l'ingrédient"
    : 'Nouvel ingrédient';
  protected readonly action = this.id ? 'Enregistrer' : "Créer l'ingrédient";
  protected readonly fil = computed(() => [
    ...FIL_DES_INGREDIENTS,
    ...(this.id
      ? [
          {
            label: this.ingredient()?.displayName ?? '…',
            link: `/repas/ingredients/${this.id}`,
          },
        ]
      : []),
    { label: this.id ? 'Modifier' : 'Nouvel ingrédient' },
  ]);

  constructor() {
    if (!this.id) {
      this.remplir(this.prefill.valeurs);
      return;
    }

    // Une modification part de l'Ingrédient lu, une seule fois : la requête
    // le complète, et une relecture n'efface pas ce qu'on a saisi depuis.
    let rempli = false;
    effect(() => {
      const ingredient = this.ingredient();
      if (ingredient && !rempli) {
        rempli = true;
        untracked(() =>
          this.remplir({ ...ingredient, ...this.prefill.valeurs }),
        );
      }
    });
  }

  protected saisirLeLibelle(evenement: Event): void {
    this.libelle.set((evenement.target as HTMLInputElement).value);
  }

  protected choisirLUnite(unite: unknown): void {
    if (UNITES_CANONIQUES.includes(unite as CanonicalUnit)) {
      this.unite.set(unite as CanonicalUnit);
    }
  }

  protected saisirLePoids(evenement: Event): void {
    const champ = evenement.target as HTMLInputElement;
    this.poidsALaPiece.set(
      champ.value === '' || Number.isNaN(champ.valueAsNumber)
        ? null
        : champ.valueAsNumber,
    );
  }

  protected declarer(allergene: Allergen, declare: boolean): void {
    this.allergenes.update((actuels) =>
      declare
        ? ALLERGENES.filter(
            (famille) => famille === allergene || actuels.includes(famille),
          )
        : actuels.filter((famille) => famille !== allergene),
    );
  }

  protected enregistrer(): void {
    const saisie: IngredientInput = {
      displayName: this.libelle(),
      canonicalUnit: this.unite() as CanonicalUnit,
      gramsPerPiece: this.avecPoidsALaPiece() ? this.poidsALaPiece() : null,
      allergens: [...this.allergenes()],
      perishable: this.perissable(),
    };

    this.envoi.set(true);
    this.refus.set(null);
    (this.id
      ? this.ingredients.modifier(this.id, saisie)
      : this.ingredients.creer(saisie)
    ).subscribe({
      next: (ingredient) => {
        this.envoi.set(false);
        showToast({
          message: this.id
            ? `« ${ingredient.displayName} » est enregistré.`
            : `« ${ingredient.displayName} » est ajouté au catalogue.`,
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
    void this.router.navigate(
      this.id ? ['/repas/ingredients', this.id] : ['/repas/ingredients'],
    );
  }

  private remplir(valeurs: Partial<Ingredient & IngredientInput>): void {
    if (valeurs.displayName !== undefined)
      this.libelle.set(valeurs.displayName);
    if (valeurs.canonicalUnit !== undefined)
      this.unite.set(valeurs.canonicalUnit);
    if (valeurs.gramsPerPiece !== undefined)
      this.poidsALaPiece.set(valeurs.gramsPerPiece);
    if (valeurs.allergens !== undefined) this.allergenes.set(valeurs.allergens);
    if (valeurs.perishable !== undefined)
      this.perissable.set(valeurs.perishable);
  }
}
