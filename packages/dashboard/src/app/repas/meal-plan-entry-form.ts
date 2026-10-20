import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matSearchOutline } from '@ng-icons/material-symbols/outline';
import {
  LIBELLES_DES_MOMENTS,
  lundiDe,
  MOMENTS_DE_REPAS,
  portions,
  zMealPlanEntryInput,
  type MealMoment,
  type MealPlanEntry,
  type MealPlanEntryInput,
} from '@personal-os/contracts';
import { HlmCheckbox } from '@personal-os/ui/checkbox';
import {
  DccmFormPage,
  DccmListRow,
  DccmState,
  DccmStepper,
  stateOf,
  type DccmStateStatus,
} from '@personal-os/ui/dccm';
import { HlmFieldImports } from '@personal-os/ui/field';
import { HlmInputImports } from '@personal-os/ui/input';
import { HlmSelectImports } from '@personal-os/ui/select';
import { showToast } from '@personal-os/ui/sonner';
import { HlmToggleGroupImports } from '@personal-os/ui/toggle-group';
import { decaler, formaterJour } from '../dates';
import type { ErreurApi } from '../erreur-api.interceptor';
import { erreursDeChamp, prefillDepuisRequete } from '../formulaire';
import { HouseholdService } from '../household.service';
import { MealPlanService } from './meal-plan.service';
import {
  FIL_DU_PLANNING,
  PARAMETRE_DE_SEMAINE,
  semaineDemandee,
} from './planning';
import { RecipeService } from './recipe.service';

/** Ce que le repas sert : une Recette, ou un intitulé libre. */
type Plat = 'recette' | 'intitule';

const PLATS: readonly { valeur: Plat; libelle: string }[] = [
  { valeur: 'recette', libelle: 'Une recette' },
  { valeur: 'intitule', libelle: 'Un intitulé' },
];

/** « mardi 20 octobre ». */
function nomDuJour(jour: string): string {
  return formaterJour(jour, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/**
 * L'ajout d'un Repas planifié : `/repas/planning/nouveau`, prérempli par sa
 * requête aux noms des champs du contrat
 * (`?semaine=2026-10-19&day=2026-10-20&moment=LUNCH&guestCount=2`). Le jour
 * dit la semaine ; sans jour, c'est `semaine`, puis la semaine en cours.
 *
 * Le repas sert une recette du Foyer, cherchée par son titre, ou un intitulé
 * libre. Les deux Comptes du Foyer sont Participants par défaut ; les
 * portions se recalculent à chaque changement.
 *
 * Rien ne s'enregistre sans « Ajouter le repas » (ADR 0030).
 */
@Component({
  imports: [
    NgIcon,
    HlmCheckbox,
    DccmFormPage,
    DccmListRow,
    DccmState,
    DccmStepper,
    HlmFieldImports,
    HlmInputImports,
    HlmSelectImports,
    HlmToggleGroupImports,
  ],
  providers: [provideIcons({ matSearchOutline })],
  templateUrl: './meal-plan-entry-form.html',
})
export class FormulaireDeRepas {
  private readonly router = inject(Router);
  private readonly service = inject(MealPlanService);
  private readonly recettes = inject(RecipeService);

  private readonly parametres = inject(ActivatedRoute).snapshot.queryParamMap;

  protected readonly prefill = prefillDepuisRequete(
    zMealPlanEntryInput,
    this.parametres,
  );

  /** La semaine du planning : celle du jour demandé, sinon celle du lien. */
  protected readonly semaine = this.prefill.valeurs.day
    ? lundiDe(this.prefill.valeurs.day)
    : semaineDemandee(this.parametres.get(PARAMETRE_DE_SEMAINE));

  protected readonly planning = this.service.planning(() => this.semaine);
  protected readonly foyer = inject(HouseholdService).foyer();

  /** Le formulaire attend le Foyer et le planning ; la première erreur l'emporte. */
  protected readonly etat = computed<DccmStateStatus>(() => {
    const etats = [
      stateOf(this.foyer, () => false),
      stateOf(this.planning, () => false),
    ];
    if (etats.includes('error')) return 'error';
    return etats.includes('loading') ? 'loading' : 'ready';
  });
  protected readonly erreurDeLecture = computed(
    () => this.foyer.error() ?? this.planning.error(),
  );

  protected readonly membres = computed(() =>
    this.foyer.hasValue() ? (this.foyer.value()?.members ?? []) : [],
  );

  protected readonly jour = signal<string | null>(
    this.prefill.valeurs.day ?? null,
  );
  protected readonly moment = signal<MealMoment | null>(
    this.prefill.valeurs.moment ?? null,
  );
  protected readonly plat = signal<Plat>(
    this.prefill.valeurs.title !== undefined ? 'intitule' : 'recette',
  );
  protected readonly recetteId = signal<string | null>(
    this.prefill.valeurs.recipeId ?? null,
  );
  protected readonly intitule = signal(this.prefill.valeurs.title ?? '');
  protected readonly invites = signal<number | null>(
    this.prefill.valeurs.guestCount ?? 0,
  );

  /** Les Participants cochés ; tous les Comptes du Foyer tant qu'on n'y touche pas. */
  private readonly decoches = signal<ReadonlySet<string>>(new Set());
  protected readonly participants = computed(() =>
    this.membres()
      .map(({ id }) => id)
      .filter((id) => !this.decoches().has(id)),
  );

  protected readonly portions = computed(() => {
    const total = portions({
      participantIds: this.participants(),
      guestCount: this.invites() ?? 0,
    });
    return `${total} portion${total > 1 ? 's' : ''}`;
  });

  protected readonly recherche = signal('');
  protected readonly catalogue = this.recettes.recettes(this.recherche);
  /** Une lecture échouée dit le `message` de l'API et propose « Réessayer ». */
  protected readonly etatDesRecettes = computed(() =>
    stateOf(this.catalogue, (recettes) => recettes.length === 0),
  );
  protected readonly trouvees = computed(() =>
    this.catalogue.hasValue() ? this.catalogue.value() : [],
  );
  /** La recette du lien, lue pour la nommer. */
  private readonly duLien = this.recettes.recette(
    () => this.prefill.valeurs.recipeId ?? null,
  );
  /** Le titre de la recette retenue, une fois la recherche passée à autre chose. */
  private readonly titreRetenu = signal<string | null>(null);
  protected readonly recetteChoisie = computed(() => {
    const id = this.recetteId();
    if (!id) return null;
    const trouvee = this.trouvees().find((recette) => recette.id === id);
    const lue = this.duLien.hasValue() ? this.duLien.value() : undefined;
    return (
      trouvee?.title ??
      this.titreRetenu() ??
      (lue?.id === id ? lue.title : null)
    );
  });

  protected readonly envoi = signal(false);
  protected readonly refus = signal<ErreurApi | null>(null);
  protected readonly erreurs = computed(() => erreursDeChamp(this.refus()));

  protected readonly jours = Array.from({ length: 7 }, (_, rang) =>
    decaler(this.semaine, rang),
  );
  protected readonly moments = MOMENTS_DE_REPAS.map((valeur) => ({
    valeur,
    libelle: LIBELLES_DES_MOMENTS[valeur],
  }));
  protected readonly plats = PLATS;

  protected readonly fil = [...FIL_DU_PLANNING, { label: 'Nouveau repas' }];

  /* `hlm-select` appelle `itemToString` détaché de l'instance : une flèche. */
  protected readonly nomDuJour = (jour: string | null | undefined): string =>
    jour ? nomDuJour(jour) : '';

  protected choisirLeJour(valeur: unknown): void {
    if (this.jours.includes(valeur as string)) {
      this.jour.set(valeur as string);
    }
  }

  protected choisirLeMoment(valeur: unknown): void {
    if (MOMENTS_DE_REPAS.includes(valeur as MealMoment)) {
      this.moment.set(valeur as MealMoment);
    }
  }

  protected choisirLePlat(valeur: unknown): void {
    if (valeur === 'recette' || valeur === 'intitule') {
      this.plat.set(valeur);
    }
  }

  protected chercher(evenement: Event): void {
    this.recherche.set((evenement.target as HTMLInputElement).value);
  }

  protected choisirLaRecette(id: string, titre: string): void {
    this.recetteId.set(id);
    this.titreRetenu.set(titre);
  }

  protected saisirLIntitule(evenement: Event): void {
    this.intitule.set((evenement.target as HTMLInputElement).value);
  }

  protected cocher(id: string, coche: boolean): void {
    const decoches = new Set(this.decoches());
    if (coche) decoches.delete(id);
    else decoches.add(id);
    this.decoches.set(decoches);
  }

  protected enregistrer(): void {
    const planning = this.planning.hasValue()
      ? this.planning.value()
      : undefined;
    if (!planning) return;

    // La saisie ne nomme que le plat choisi : l'autre champ n'est pas envoyé.
    const recetteId = this.recetteId();
    const plat =
      this.plat() === 'intitule'
        ? { title: this.intitule() }
        : recetteId
          ? { recipeId: recetteId }
          : {};
    const saisie = {
      day: this.jour(),
      moment: this.moment(),
      ...plat,
      participantIds: this.participants(),
      guestCount: this.invites() ?? 0,
    } as MealPlanEntryInput;

    this.envoi.set(true);
    this.refus.set(null);
    this.service.ajouter(planning.id, saisie).subscribe({
      next: (repas) => {
        this.envoi.set(false);
        showToast({ tone: 'success', message: this.confirmation(repas) });
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
      queryParams: { [PARAMETRE_DE_SEMAINE]: this.semaine },
    });
  }

  private confirmation(repas: MealPlanEntry): string {
    const titre = repas.recipe?.title ?? repas.title ?? '';
    const moment = LIBELLES_DES_MOMENTS[repas.moment].toLowerCase();
    return `«\u00a0${titre}\u00a0» : ${moment} du ${nomDuJour(repas.day)}.`;
  }
}
