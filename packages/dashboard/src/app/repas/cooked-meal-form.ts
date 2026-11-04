import {
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matCloseOutline,
  matSearchOutline,
} from '@ng-icons/material-symbols/outline';
import {
  ajusterAuxPortions,
  LIBELLES_DES_MOMENTS,
  lundiDe,
  uniteDeSaisie,
  zCookedMealInput,
  type CanonicalUnit,
  type CookedMeal,
  type CookedMealInput,
  type MealPlanEntry,
  type Recipe,
  type RecipeUnit,
} from '@personal-os/contracts';
import { HlmAlertImports } from '@personal-os/ui/alert';
import { HlmButton } from '@personal-os/ui/button';
import {
  DccmFormPage,
  DccmListRow,
  DccmPageHeader,
  DccmState,
  stateOf,
  type DccmStateStatus,
} from '@personal-os/ui/dccm';
import { HlmFieldImports } from '@personal-os/ui/field';
import { HlmInputImports } from '@personal-os/ui/input';
import { showToast } from '@personal-os/ui/sonner';
import { formaterJour } from '../dates';
import type { ErreurApi } from '../erreur-api.interceptor';
import { erreursDeChamp, prefillDepuisRequete } from '../formulaire';
import { CookedMealService } from './cooked-meal.service';
import { IngredientService } from './ingredient.service';
import { messageDeManque } from './manque';
import { MealPlanService } from './meal-plan.service';
import { FIL_DU_PLANNING, PARAMETRE_DE_SEMAINE } from './planning';
import { portions, quantiteDeLigne, uniteDeLigne } from './quantite';
import { RecipeService } from './recipe.service';

/** Une ligne déclarée, telle que l'écran la tient pendant la saisie. */
interface LigneSaisie {
  /** Une clé locale : deux lignes du même Ingrédient restent distinctes. */
  cle: number;
  ingredientId: string;
  nom: string;
  quantite: number | null;
  unite: RecipeUnit;
  /** « Recette : 250 g » pour une ligne de la recette ; vide pour une ligne libre. */
  prevu: string | null;
}

/** Un Ingrédient du catalogue, ce qu'il faut pour en faire une ligne libre. */
interface IngredientAjoute {
  id: string;
  displayName: string;
  canonicalUnit: CanonicalUnit;
}

let prochaineCle = 0;

/** Les lignes de la recette, ajustées aux portions du repas. */
function lignesDeLaRecette(
  recette: Recipe | undefined,
  repas: MealPlanEntry | undefined,
): LigneSaisie[] {
  if (!recette || !repas) return [];
  return recette.lines.map((ligne) => ({
    cle: prochaineCle++,
    ingredientId: ligne.ingredient.id,
    nom: ligne.ingredient.displayName,
    quantite: ajusterAuxPortions(
      ligne.quantity,
      recette.servings,
      repas.servings,
    ),
    unite: ligne.unit,
    prevu: `Recette : ${quantiteDeLigne(ligne)}`,
  }));
}

/**
 * La déclaration d'un Repas cuisiné : `/repas/cuisine/nouveau?mealPlanEntryId=…`,
 * ouverte par « Cuisiné » sur un repas approuvé du planning. Le repas d'une
 * recette se préremplit de ses lignes, ajustées aux portions du repas ; on y
 * dit ce qu'on a **réellement** utilisé, on retire ce qu'on n'a pas mis, on
 * ajoute ce que la recette ne prévoyait pas. Un repas sans recette ne déclare
 * que des lignes libres.
 *
 * Rien ne s'enregistre sans « Valider et déstocker » (ADR 0030). Le stock
 * baisse des quantités déclarées ; ce qu'il n'avait pas s'affiche après
 * l'enregistrement, sans l'empêcher.
 */
@Component({
  imports: [
    RouterLink,
    NgIcon,
    HlmAlertImports,
    HlmButton,
    DccmFormPage,
    DccmListRow,
    DccmPageHeader,
    DccmState,
    HlmFieldImports,
    HlmInputImports,
  ],
  providers: [provideIcons({ matSearchOutline, matCloseOutline })],
  templateUrl: './cooked-meal-form.html',
})
export class FormulaireDeRepasCuisine {
  private readonly router = inject(Router);
  private readonly service = inject(CookedMealService);
  private readonly ingredients = inject(IngredientService);

  protected readonly prefill = prefillDepuisRequete(
    zCookedMealInput,
    inject(ActivatedRoute).snapshot.queryParamMap,
  );
  private readonly repasId = this.prefill.valeurs.mealPlanEntryId ?? null;

  protected readonly lectureDuRepas = inject(MealPlanService).repas(
    () => this.repasId,
  );
  protected readonly repas = computed(() =>
    this.lectureDuRepas.hasValue() ? this.lectureDuRepas.value() : undefined,
  );
  protected readonly lectureDeLaRecette = inject(RecipeService).recette(
    () => this.repas()?.recipe?.id ?? null,
  );
  private readonly recette = computed(() =>
    this.lectureDeLaRecette.hasValue()
      ? this.lectureDeLaRecette.value()
      : undefined,
  );

  /** Le formulaire attend le repas, puis sa recette ; la première erreur l'emporte. */
  protected readonly etat = computed<DccmStateStatus>(() => {
    if (!this.repasId) return 'empty';
    const etats = [stateOf(this.lectureDuRepas, () => false)];
    if (this.repas()?.recipe) {
      etats.push(stateOf(this.lectureDeLaRecette, () => false));
    }
    if (etats.includes('error')) return 'error';
    return etats.includes('loading') ? 'loading' : 'ready';
  });
  protected readonly erreurDeLecture = computed(
    () => this.lectureDuRepas.error() ?? this.lectureDeLaRecette.error(),
  );

  /** « Dîner · lundi 19 octobre ». */
  protected readonly quand = computed(() => {
    const repas = this.repas();
    if (!repas) return '';
    const jour = formaterJour(repas.day, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    return `${LIBELLES_DES_MOMENTS[repas.moment]} · ${jour}`;
  });
  protected readonly titre = computed(() => {
    const repas = this.repas();
    return repas?.recipe?.title ?? repas?.title ?? '';
  });
  protected readonly prevuPour = computed(() => {
    const repas = this.repas();
    if (!repas) return '';
    const recette = this.recette();
    const prevu = `Prévu pour ${portions(repas.servings)}`;
    return recette && recette.servings !== repas.servings
      ? `${prevu}. La recette, pour ${portions(recette.servings)}, est ajustée.`
      : `${prevu}.`;
  });

  /** Les lignes de la recette dès qu'elle est lue ; on les modifie ensuite à la main. */
  protected readonly lignes = linkedSignal<LigneSaisie[]>(() =>
    lignesDeLaRecette(this.recette(), this.repas()),
  );

  protected readonly recherche = signal('');
  protected readonly catalogue = this.ingredients.catalogue(
    this.recherche,
    () => this.recherche().trim() !== '',
  );
  protected readonly etatDuCatalogue = computed(() =>
    stateOf(this.catalogue, (ingredients) => ingredients.length === 0),
  );
  protected readonly trouves = computed(() =>
    this.catalogue.hasValue() ? this.catalogue.value() : [],
  );

  protected readonly envoi = signal(false);
  protected readonly refus = signal<ErreurApi | null>(null);
  protected readonly erreurs = computed(() => erreursDeChamp(this.refus()));
  /** Le Repas cuisiné enregistré, quand le stock n'avait pas tout. */
  protected readonly declare = signal<CookedMeal | null>(null);
  protected readonly manques = computed(() =>
    (this.declare()?.shortfalls ?? []).map(messageDeManque),
  );

  protected readonly fil = [...FIL_DU_PLANNING, { label: 'Repas cuisiné' }];

  /** Le planning de la semaine du repas, où l'on revient. */
  protected readonly retour = computed(() => {
    const repas = this.repas();
    return repas ? { [PARAMETRE_DE_SEMAINE]: lundiDe(repas.day) } : {};
  });

  /** Le refus de l'API qui vise une ligne, par son rang. */
  protected erreurDeLigne(rang: number): string | undefined {
    const erreurs = this.erreurs();
    return (
      erreurs[`lines.${rang}.quantity`] ??
      erreurs[`lines.${rang}.unit`] ??
      erreurs[`lines.${rang}.ingredientId`]
    );
  }

  protected uniteDe(ligne: LigneSaisie): string {
    return uniteDeLigne(ligne.unite);
  }

  protected saisirLaQuantite(cle: number, evenement: Event): void {
    const champ = evenement.target as HTMLInputElement;
    const quantite =
      champ.value === '' || Number.isNaN(champ.valueAsNumber)
        ? null
        : champ.valueAsNumber;
    this.lignes.update((lignes) =>
      lignes.map((ligne) =>
        ligne.cle === cle ? { ...ligne, quantite } : ligne,
      ),
    );
  }

  protected retirer(cle: number): void {
    // Les erreurs de champ visent un rang : elles ne valent plus une fois les
    // lignes décalées.
    this.refus.set(null);
    this.lignes.update((lignes) => lignes.filter((ligne) => ligne.cle !== cle));
  }

  protected chercher(evenement: Event): void {
    this.recherche.set((evenement.target as HTMLInputElement).value);
  }

  /** Une ligne libre, dans l'Unité canonique de l'Ingrédient, à quantité vide. */
  protected ajouter(ingredient: IngredientAjoute): void {
    this.lignes.update((lignes) => [
      ...lignes,
      {
        cle: prochaineCle++,
        ingredientId: ingredient.id,
        nom: ingredient.displayName,
        quantite: null,
        unite: uniteDeSaisie(ingredient.canonicalUnit),
        prevu: null,
      },
    ]);
    this.recherche.set('');
  }

  protected enregistrer(): void {
    const repas = this.repas();
    if (!repas) return;
    // Une quantité vide part telle quelle : l'API dit ce qui ne va pas.
    const saisie = {
      mealPlanEntryId: repas.id,
      lines: this.lignes().map(({ ingredientId, quantite, unite }) => ({
        ingredientId,
        quantity: quantite,
        unit: unite,
      })),
    } as CookedMealInput;

    this.envoi.set(true);
    this.refus.set(null);
    this.service.declarer(saisie).subscribe({
      next: (declare) => {
        this.envoi.set(false);
        if (declare.shortfalls.length > 0) {
          this.declare.set(declare);
          return;
        }
        showToast({
          tone: 'success',
          message: `« ${this.titre()} » est cuisiné : le stock est à jour.`,
        });
        this.fermer();
      },
      error: (erreur: ErreurApi) => {
        this.envoi.set(false);
        this.refus.set(erreur);
      },
    });
  }

  protected fermer(): void {
    void this.router.navigate(['/repas/planning'], {
      queryParams: this.retour(),
    });
  }
}
