import {
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matAddOutline,
  matArrowDownwardOutline,
  matArrowUpwardOutline,
  matCheckCircleOutline,
  matDeleteOutline,
} from '@ng-icons/material-symbols/outline';
import {
  LIBELLES_DES_UNITES_DE_RECETTE,
  normaliserLibelle,
  UNITES_DE_RECETTE,
  zRecipeInput,
  type IngredientResolution,
  type Recipe,
  type RecipeInput,
  type RecipeUnit,
} from '@personal-os/contracts';
import { HlmAlertImports } from '@personal-os/ui/alert';
import { HlmBadge } from '@personal-os/ui/badge';
import { HlmButton } from '@personal-os/ui/button';
import {
  DccmFormPage,
  DccmState,
  DccmStepper,
  stateOf,
} from '@personal-os/ui/dccm';
import { HlmFieldImports } from '@personal-os/ui/field';
import { HlmInput } from '@personal-os/ui/input';
import { HlmSelectImports } from '@personal-os/ui/select';
import { showToast } from '@personal-os/ui/sonner';
import type { ErreurApi } from '../erreur-api.interceptor';
import { erreursDeChamp, prefillDepuisRequete } from '../formulaire';
import {
  BrouillonsDeRecette,
  type EtapeSaisie,
  type LigneSaisie,
  type Rattachement,
} from './brouillon-de-recette';
import { IngredientService } from './ingredient.service';
import { RecipeService } from './recipe.service';
import { FIL_DES_RECETTES } from './recipes';

/** Le paramètre du retour depuis la création d'un Ingrédient : reprendre la saisie. */
export const PARAMETRE_DE_BROUILLON = 'brouillon';
/** L'Ingrédient créé au retour, pour la ligne qui l'attendait. */
export const PARAMETRE_D_INGREDIENT = 'ingredient';

const A_RESOUDRE: Rattachement = { etat: 'a-resoudre' };

/** Une ligne n'est saisie que si elle a un libellé ou une quantité : sinon on l'ignore. */
function estSaisie(ligne: LigneSaisie): boolean {
  return ligne.libelle.trim() !== '' || ligne.quantite !== null;
}

/**
 * La saisie d'une Recette : `/repas/recettes/nouvelle` pour une création,
 * `/repas/recettes/:id/modifier` pour une modification. La création se
 * préremplit par sa requête (`?title=Gratin&servings=4`), une modification
 * part de la recette, que la requête complète.
 *
 * Une ligne d'ingrédient est une quantité, une unité et un libellé libre :
 * pas d'analyse de phrase. À l'enregistrement, tous les libellés pas encore
 * rattachés sont résolus en un appel. Un libellé inconnu montre ses
 * suggestions : en choisir une crée l'Alias ; « Créer l'ingrédient » ouvre la
 * création préremplie, et revient ici avec l'Ingrédient créé. La recette ne
 * s'enregistre que quand chaque ligne a son Ingrédient.
 *
 * Rien ne s'enregistre sans « Créer la recette » ou « Enregistrer » (ADR 0030).
 */
@Component({
  imports: [
    NgIcon,
    DccmFormPage,
    DccmState,
    DccmStepper,
    HlmAlertImports,
    HlmBadge,
    HlmButton,
    HlmFieldImports,
    HlmInput,
    HlmSelectImports,
  ],
  providers: [
    provideIcons({
      matAddOutline,
      matArrowDownwardOutline,
      matArrowUpwardOutline,
      matCheckCircleOutline,
      matDeleteOutline,
    }),
  ],
  templateUrl: './recipe-form.html',
})
export class FormulaireDeRecette {
  private readonly router = inject(Router);
  private readonly recettes = inject(RecipeService);
  private readonly ingredients = inject(IngredientService);
  private readonly brouillons = inject(BrouillonsDeRecette);
  private readonly route = inject(ActivatedRoute).snapshot;

  /** La recette modifiée ; vide pour une création. */
  protected readonly id = this.route.paramMap.get('id');
  /** Le chemin du formulaire, sans requête : celui du retour. */
  private readonly chemin = this.id
    ? `/repas/recettes/${this.id}/modifier`
    : '/repas/recettes/nouvelle';

  protected readonly actuelle = this.recettes.recette(() => this.id);
  /** La recette lue ; rien quand la lecture a échoué (lire `value()` lèverait). */
  private readonly recette = computed(() =>
    this.actuelle.hasValue() ? this.actuelle.value() : undefined,
  );
  protected readonly etatDeLaLecture = computed(() =>
    this.id ? stateOf(this.actuelle, () => false) : 'ready',
  );

  protected readonly prefill = prefillDepuisRequete(
    zRecipeInput,
    this.route.queryParamMap,
  );

  protected readonly titre = signal('');
  protected readonly portions = signal<number | null>(2);
  protected readonly etapes = signal<readonly EtapeSaisie[]>([]);
  protected readonly lignes = signal<readonly LigneSaisie[]>([]);
  private prochaineCle = 0;

  /** Les noms des Ingrédients qu'on connaît sans lire le catalogue. */
  private readonly nomsConnus = signal<ReadonlyMap<string, string>>(new Map());
  /** Le catalogue n'est lu que pour nommer des suggestions ou un Ingrédient pas encore nommé. */
  private readonly catalogueUtile = computed(() =>
    this.lignes().some(
      ({ rattachement }) =>
        rattachement.etat === 'inconnu' ||
        (rattachement.etat === 'reconnu' &&
          !this.nomsConnus().has(rattachement.ingredientId)),
    ),
  );
  private readonly catalogue = this.ingredients.catalogue(
    () => '',
    this.catalogueUtile,
  );
  private readonly noms = computed(() => {
    const noms = new Map(this.nomsConnus());
    if (this.catalogue.hasValue()) {
      for (const { id, displayName } of this.catalogue.value()) {
        noms.set(id, displayName);
      }
    }
    return noms;
  });

  protected readonly envoi = signal(false);
  /** La ligne dont le rattachement est en cours. */
  protected readonly rattachementEnCours = signal<number | null>(null);
  protected readonly refus = signal<ErreurApi | null>(null);
  protected readonly erreurs = computed(() => erreursDeChamp(this.refus()));
  /** Les lignes et les étapes envoyées, dans leur ordre : `fields` y renvoie par rang. */
  private readonly lignesEnvoyees = signal<readonly number[]>([]);
  private readonly etapesEnvoyees = signal<readonly number[]>([]);

  protected readonly inconnus = computed(
    () =>
      this.lignes().filter(
        ({ rattachement }) => rattachement.etat === 'inconnu',
      ).length,
  );

  protected readonly unites = UNITES_DE_RECETTE;
  /* `hlm-select` appelle `itemToString` détaché de l'instance : une flèche. */
  protected readonly libelleDeLUnite = (
    unite: RecipeUnit | null | undefined,
  ): string => (unite ? LIBELLES_DES_UNITES_DE_RECETTE[unite] : '');

  protected readonly entete = this.id
    ? 'Modifier la recette'
    : 'Nouvelle recette';
  protected readonly action = this.id ? 'Enregistrer' : 'Créer la recette';
  protected readonly fil = computed(() => [
    ...FIL_DES_RECETTES,
    ...(this.id
      ? [
          {
            label: this.recette()?.title ?? '…',
            link: `/repas/recettes/${this.id}`,
          },
        ]
      : []),
    { label: this.id ? 'Modifier' : 'Nouvelle recette' },
  ]);

  constructor() {
    if (this.reprendreLeBrouillon()) return;

    if (!this.id) {
      this.remplir(this.prefill.valeurs);
      return;
    }

    // Une modification part de la recette lue, une seule fois : la requête la
    // complète, et une relecture n'efface pas ce qu'on a saisi depuis.
    let rempli = false;
    effect(() => {
      const recette = this.recette();
      if (recette && !rempli) {
        rempli = true;
        untracked(() => this.remplir({ ...recette, ...this.prefill.valeurs }));
      }
    });
  }

  protected nomDe(ingredientId: string): string | undefined {
    return this.noms().get(ingredientId);
  }

  protected erreurDeLigne(cle: number, champ: string): string | undefined {
    const rang = this.lignesEnvoyees().indexOf(cle);
    return rang < 0 ? undefined : this.erreurs()[`lines.${rang}.${champ}`];
  }

  /** La première erreur de la ligne, sous elle. */
  protected erreurDeLaLigne(cle: number): string | undefined {
    return (
      this.erreurDeLigne(cle, 'quantity') ??
      this.erreurDeLigne(cle, 'unit') ??
      this.erreurDeLigne(cle, 'ingredientId')
    );
  }

  /** Le nom de l'Ingrédient de la ligne, quand elle en a un et qu'on le connaît. */
  protected ingredientReconnu(ligne: LigneSaisie): string | undefined {
    return ligne.rattachement.etat === 'reconnu'
      ? this.nomDe(ligne.rattachement.ingredientId)
      : undefined;
  }

  /** Les suggestions d'un libellé inconnu ; rien pour une autre ligne. */
  protected suggestionsDe(ligne: LigneSaisie): readonly string[] | undefined {
    return ligne.rattachement.etat === 'inconnu'
      ? ligne.rattachement.suggestions
      : undefined;
  }

  protected erreurDEtape(cle: number): string | undefined {
    const rang = this.etapesEnvoyees().indexOf(cle);
    return rang < 0 ? undefined : this.erreurs()[`steps.${rang}`];
  }

  protected saisirLeTitre(evenement: Event): void {
    this.titre.set((evenement.target as HTMLInputElement).value);
  }

  protected ajouterUneLigne(): void {
    this.lignes.update((lignes) => [...lignes, this.nouvelleLigne()]);
  }

  protected retirerLaLigne(cle: number): void {
    this.lignes.update((lignes) => lignes.filter((ligne) => ligne.cle !== cle));
  }

  protected saisirLaQuantite(cle: number, evenement: Event): void {
    const champ = evenement.target as HTMLInputElement;
    const quantite =
      champ.value === '' || Number.isNaN(champ.valueAsNumber)
        ? null
        : champ.valueAsNumber;
    this.changerLaLigne(cle, { quantite });
  }

  protected choisirLUnite(cle: number, unite: unknown): void {
    if (UNITES_DE_RECETTE.includes(unite as RecipeUnit)) {
      this.changerLaLigne(cle, { unite: unite as RecipeUnit });
    }
  }

  /** Un libellé changé perd son Ingrédient : il sera résolu de nouveau. */
  protected saisirLeLibelle(cle: number, evenement: Event): void {
    this.changerLaLigne(cle, {
      libelle: (evenement.target as HTMLInputElement).value,
      rattachement: A_RESOUDRE,
      refus: null,
    });
  }

  protected ajouterUneEtape(): void {
    this.etapes.update((etapes) => [
      ...etapes,
      { cle: this.prochaineCle++, texte: '' },
    ]);
  }

  protected saisirLEtape(cle: number, evenement: Event): void {
    const texte = (evenement.target as HTMLTextAreaElement).value;
    this.etapes.update((etapes) =>
      etapes.map((etape) => (etape.cle === cle ? { cle, texte } : etape)),
    );
  }

  /** Déplace une étape d'un rang, vers le haut (-1) ou vers le bas (+1). */
  protected deplacerLEtape(rang: number, sens: -1 | 1): void {
    this.etapes.update((etapes) => {
      const cible = rang + sens;
      if (cible < 0 || cible >= etapes.length) return etapes;
      const deplacees = [...etapes];
      [deplacees[rang], deplacees[cible]] = [deplacees[cible], deplacees[rang]];
      return deplacees;
    });
  }

  protected retirerLEtape(cle: number): void {
    this.etapes.update((etapes) => etapes.filter((etape) => etape.cle !== cle));
  }

  /**
   * Rattache le libellé de la ligne à une suggestion, ce qui crée l'Alias :
   * les lignes au même libellé reçoivent le même Ingrédient.
   */
  protected rattacher(ligne: LigneSaisie, ingredientId: string): void {
    this.rattachementEnCours.set(ligne.cle);
    this.ingredients
      .rattacher({ label: ligne.libelle, ingredientId })
      .subscribe({
        next: () => {
          this.rattachementEnCours.set(null);
          this.attribuer(ligne.libelle, ingredientId);
        },
        error: (erreur: ErreurApi) => {
          this.rattachementEnCours.set(null);
          this.changerLaLigne(ligne.cle, { refus: erreur.message });
        },
      });
  }

  /**
   * Ouvre la création de l'Ingrédient, préremplie par le libellé. La saisie
   * est mise de côté, et reprise au retour.
   */
  protected creerLIngredient(ligne: LigneSaisie): void {
    this.brouillons.garder(this.chemin, {
      titre: this.titre(),
      portions: this.portions(),
      etapes: this.etapes(),
      lignes: this.lignes(),
      enAttente: ligne.cle,
    });
    void this.router.navigate(['/repas/ingredients/nouveau'], {
      queryParams: {
        displayName: ligne.libelle.trim(),
        retour: `${this.chemin}?${PARAMETRE_DE_BROUILLON}=1`,
      },
    });
  }

  /** Résout ce qui ne l'est pas encore, puis enregistre si chaque ligne a son Ingrédient. */
  protected enregistrer(): void {
    const aResoudre = this.lignes().filter(
      (ligne) =>
        ligne.rattachement.etat === 'a-resoudre' && ligne.libelle.trim() !== '',
    );
    this.refus.set(null);
    if (aResoudre.length === 0) {
      this.envoyer();
      return;
    }

    this.envoi.set(true);
    this.ingredients
      .resoudre(aResoudre.map(({ libelle }) => libelle))
      .subscribe({
        next: (resolutions) => {
          this.appliquer(aResoudre, resolutions);
          if (this.inconnus() === 0) {
            this.envoyer();
          } else {
            this.envoi.set(false);
          }
        },
        error: (erreur: ErreurApi) => {
          this.envoi.set(false);
          this.refus.set(erreur);
        },
      });
  }

  protected fermer(): void {
    void this.router.navigate(
      this.id ? ['/repas/recettes', this.id] : ['/repas/recettes'],
    );
  }

  private envoyer(): void {
    const lignes = this.lignes().filter(estSaisie);
    const etapes = this.etapes().filter(({ texte }) => texte.trim() !== '');
    const saisie = {
      title: this.titre(),
      servings: this.portions(),
      steps: etapes.map(({ texte }) => texte),
      lines: lignes.map(({ quantite, unite, rattachement }) => ({
        ingredientId:
          rattachement.etat === 'reconnu' ? rattachement.ingredientId : '',
        quantity: quantite,
        unit: unite,
      })),
    } as RecipeInput;

    this.envoi.set(true);
    this.lignesEnvoyees.set(lignes.map(({ cle }) => cle));
    this.etapesEnvoyees.set(etapes.map(({ cle }) => cle));
    (this.id
      ? this.recettes.modifier(this.id, saisie)
      : this.recettes.creer(saisie)
    ).subscribe({
      next: (recette) => {
        this.envoi.set(false);
        showToast({
          message: this.id
            ? `« ${recette.title} » est enregistrée.`
            : `« ${recette.title} » est ajoutée aux recettes.`,
        });
        void this.router.navigate(['/repas/recettes', recette.id]);
      },
      error: (erreur: ErreurApi) => {
        this.envoi.set(false);
        this.refus.set(erreur);
      },
    });
  }

  /** Le sort de chaque libellé, dans l'ordre de la demande. */
  private appliquer(
    resolues: readonly LigneSaisie[],
    resolutions: readonly IngredientResolution[],
  ): void {
    const parCle = new Map(
      resolues.map(({ cle }, rang) => [cle, resolutions[rang]]),
    );
    this.lignes.update((lignes) =>
      lignes.map((ligne) => {
        const resolution = parCle.get(ligne.cle);
        if (!resolution) return ligne;
        return {
          ...ligne,
          refus: null,
          rattachement:
            'ingredientId' in resolution
              ? { etat: 'reconnu', ingredientId: resolution.ingredientId }
              : { etat: 'inconnu', suggestions: resolution.suggestions },
        };
      }),
    );
  }

  /** Les lignes inconnues à ce libellé, normalisé, reçoivent l'Ingrédient. */
  private attribuer(libelle: string, ingredientId: string): void {
    const normalise = normaliserLibelle(libelle);
    this.lignes.update((lignes) =>
      lignes.map((ligne) =>
        ligne.rattachement.etat === 'inconnu' &&
        normaliserLibelle(ligne.libelle) === normalise
          ? {
              ...ligne,
              refus: null,
              rattachement: { etat: 'reconnu', ingredientId },
            }
          : ligne,
      ),
    );
  }

  private changerLaLigne(cle: number, changements: Partial<LigneSaisie>): void {
    this.lignes.update((lignes) =>
      lignes.map((ligne) =>
        ligne.cle === cle ? { ...ligne, ...changements } : ligne,
      ),
    );
  }

  private nouvelleLigne(): LigneSaisie {
    return {
      cle: this.prochaineCle++,
      quantite: null,
      unite: null,
      libelle: '',
      rattachement: A_RESOUDRE,
      refus: null,
    };
  }

  /**
   * Au retour de la création d'un Ingrédient, la saisie reprend où on l'a
   * laissée, et la ligne qui l'attendait reçoit l'Ingrédient créé.
   */
  private reprendreLeBrouillon(): boolean {
    const parametres = this.route.queryParamMap;
    if (!parametres.has(PARAMETRE_DE_BROUILLON)) return false;
    const brouillon = this.brouillons.reprendre(this.chemin);
    if (!brouillon) return false;

    this.titre.set(brouillon.titre);
    this.portions.set(brouillon.portions);
    this.etapes.set(brouillon.etapes);
    this.lignes.set(brouillon.lignes);
    this.prochaineCle =
      Math.max(
        -1,
        ...brouillon.lignes.map(({ cle }) => cle),
        ...brouillon.etapes.map(({ cle }) => cle),
      ) + 1;

    const cree = parametres.get(PARAMETRE_D_INGREDIENT);
    const attendue = brouillon.lignes.find(
      ({ cle }) => cle === brouillon.enAttente,
    );
    if (cree && attendue) this.attribuer(attendue.libelle, cree);
    return true;
  }

  private remplir(valeurs: Partial<Recipe & RecipeInput>): void {
    if (valeurs.title !== undefined) this.titre.set(valeurs.title);
    if (valeurs.servings !== undefined) this.portions.set(valeurs.servings);
    this.etapes.set(
      (valeurs.steps ?? []).map((texte) => ({
        cle: this.prochaineCle++,
        texte,
      })),
    );
    if (this.etapes().length === 0) this.ajouterUneEtape();

    const lues = (valeurs as Partial<Recipe>).lines ?? [];
    this.nomsConnus.set(
      new Map(
        lues.map(({ ingredient }) => [ingredient.id, ingredient.displayName]),
      ),
    );
    this.lignes.set(
      lues.length
        ? lues.map(({ ingredient, quantity, unit }) => ({
            cle: this.prochaineCle++,
            quantite: quantity,
            unite: unit,
            libelle: ingredient.displayName,
            rattachement: { etat: 'reconnu', ingredientId: ingredient.id },
            refus: null,
          }))
        : [this.nouvelleLigne()],
    );
  }
}
