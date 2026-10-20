import {
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matAddOutline,
  matCloseOutline,
  matLightbulbOutline,
  matSearchOutline,
} from '@ng-icons/material-symbols/outline';
import {
  zMealWishInput,
  type MealWish,
  type MealWishInput,
} from '@personal-os/contracts';
import { HlmAlertImports } from '@personal-os/ui/alert';
import { HlmBadge } from '@personal-os/ui/badge';
import { HlmButton } from '@personal-os/ui/button';
import { HlmCardImports } from '@personal-os/ui/card';
import {
  DccmConfirm,
  DccmListRow,
  DccmState,
  stateOf,
} from '@personal-os/ui/dccm';
import { HlmFieldImports } from '@personal-os/ui/field';
import { HlmInputImports } from '@personal-os/ui/input';
import { showToast } from '@personal-os/ui/sonner';
import { HlmToggleGroupImports } from '@personal-os/ui/toggle-group';
import * as z from 'zod';
import type { ErreurApi } from '../erreur-api.interceptor';
import { erreursDeChamp, prefillDepuisRequete } from '../formulaire';
import { MealWishService } from './meal-wish.service';
import { RecipeService } from './recipe.service';

/** Ce que le Souhait demande : une envie en texte libre, ou une Recette. */
type Mode = 'envie' | 'recette';

const MODES: readonly { valeur: Mode; libelle: string }[] = [
  { valeur: 'envie', libelle: 'Une envie' },
  { valeur: 'recette', libelle: 'Une recette' },
];

/**
 * Ce que le lien peut préremplir : la recette ou l'envie. La semaine est
 * celle que l'écran affiche (`semaine`).
 */
const zSouhaitDuLien = /* @__PURE__ */ z.object({
  recipeId: zMealWishInput.shape.recipeId,
  text: zMealWishInput.shape.text,
});

/** Ce qu'un Souhait demande, en clair. */
function intitule(souhait: MealWish): string {
  return souhait.recipe?.title ?? souhait.text ?? '';
}

/**
 * Les Souhaits d'une semaine, sur l'écran de son Planning de repas : les
 * envies et les Recettes que le Foyer veut voir dans la génération. Chacun
 * des deux Comptes en dépose et en retire, les siens comme ceux de l'autre.
 *
 * Une envie part au clic sur « + », une Recette au clic sur son titre : rien
 * ne s'enregistre sans geste. Un retrait se confirme. Le lien de l'écran
 * préremplit l'envie (`text`) ou propose une Recette (`recipeId`), sans
 * rien déposer (ADR 0030).
 */
@Component({
  selector: 'pos-souhaits-de-la-semaine',
  imports: [
    NgIcon,
    HlmAlertImports,
    HlmBadge,
    HlmButton,
    HlmCardImports,
    HlmFieldImports,
    HlmInputImports,
    HlmToggleGroupImports,
    DccmListRow,
    DccmState,
  ],
  providers: [
    provideIcons({
      matAddOutline,
      matCloseOutline,
      matLightbulbOutline,
      matSearchOutline,
    }),
  ],
  templateUrl: './souhaits.html',
})
export class SouhaitsDeLaSemaine {
  private readonly service = inject(MealWishService);
  private readonly recettes = inject(RecipeService);
  private readonly confirmation = inject(DccmConfirm);

  /** La semaine, par son lundi. */
  readonly semaine = input.required<string>();
  /** Le nom de chaque Compte du Foyer, par son identifiant. */
  readonly noms = input<ReadonlyMap<string, string>>(new Map());

  protected readonly prefill = prefillDepuisRequete(
    zSouhaitDuLien,
    inject(ActivatedRoute).snapshot.queryParamMap,
  );

  protected readonly lecture = this.service.souhaits(() => this.semaine());
  protected readonly etat = computed(() =>
    stateOf(this.lecture, (souhaits) => souhaits.length === 0),
  );

  protected readonly souhaits = computed(() =>
    (this.lecture.hasValue() ? this.lecture.value() : []).map((souhait) => ({
      id: souhait.id,
      intitule: intitule(souhait),
      auteur: this.noms().get(souhait.authorId) ?? souhait.authorId,
      recette: souhait.recipe !== null,
    })),
  );
  protected readonly compte = computed(() => {
    const nombre = this.souhaits().length;
    return `${nombre} souhait${nombre > 1 ? 's' : ''}`;
  });

  protected readonly modes = MODES;
  protected readonly mode = signal<Mode>(
    this.prefill.valeurs.recipeId === undefined ? 'envie' : 'recette',
  );
  protected readonly envie = signal(this.prefill.valeurs.text ?? '');

  /** La recherche de recettes, lue seulement quand on cherche une Recette. */
  protected readonly recherche = signal('');
  protected readonly catalogue = this.recettes.recettes(() =>
    this.mode() === 'recette' ? this.recherche() : null,
  );
  protected readonly etatDesRecettes = computed(() =>
    stateOf(this.catalogue, (recettes) => recettes.length === 0),
  );
  protected readonly trouvees = computed(() =>
    this.catalogue.hasValue() ? this.catalogue.value() : [],
  );
  /** La Recette que le lien propose, lue pour la nommer ; déposée, elle part. */
  private readonly idProposee = signal(this.prefill.valeurs.recipeId ?? null);
  private readonly lectureDeLaProposee = this.recettes.recette(() =>
    this.idProposee(),
  );
  protected readonly proposee = computed(() =>
    this.lectureDeLaProposee.hasValue()
      ? (this.lectureDeLaProposee.value() ?? null)
      : null,
  );
  /** Les valeurs du lien écartées : par le contrat, ou une Recette inconnue. */
  protected readonly ignores = computed(() => [
    ...this.prefill.ignores,
    ...(this.lectureDeLaProposee.error()
      ? [`recipeId=${this.idProposee()}`]
      : []),
  ]);
  /** Les Recettes déjà souhaitées pour la semaine : on ne les redemande pas. */
  protected readonly dejaSouhaitees = computed(
    () =>
      new Set(
        (this.lecture.hasValue() ? this.lecture.value() : []).flatMap(
          ({ recipe }) => (recipe ? [recipe.id] : []),
        ),
      ),
  );

  protected readonly envoi = signal(false);
  /** Le Souhait en cours de retrait, le temps de la requête. */
  protected readonly retrait = signal<string | null>(null);
  /**
   * Le refus du dernier geste : sous le champ qu'il vise, en bandeau sinon.
   * Une autre semaine l'efface.
   */
  protected readonly refus = linkedSignal<string, ErreurApi | null>({
    source: this.semaine,
    computation: () => null,
  });
  protected readonly erreurs = computed(() => erreursDeChamp(this.refus()));
  protected readonly erreurDuChamp = computed(
    () =>
      this.erreurs()['text'] ??
      this.erreurs()['recipeId'] ??
      this.erreurs()['week'] ??
      null,
  );

  protected choisirLeMode(valeur: unknown): void {
    if (valeur === 'envie' || valeur === 'recette') {
      this.mode.set(valeur);
      this.refus.set(null);
    }
  }

  protected saisir(evenement: Event): void {
    this.envie.set((evenement.target as HTMLInputElement).value);
  }

  protected chercher(evenement: Event): void {
    this.recherche.set((evenement.target as HTMLInputElement).value);
  }

  protected deposerLEnvie(): void {
    const texte = this.envie().trim();
    if (!texte) return;
    const semaine = this.semaine();
    // La réponse peut arriver après une autre saisie, ou sur une autre
    // semaine : le champ ne se vide que s'il porte encore cette envie.
    this.deposer({ week: semaine, text: texte }, () => {
      if (this.semaine() === semaine && this.envie().trim() === texte) {
        this.envie.set('');
      }
    });
  }

  protected deposerLaRecette(id: string): void {
    this.deposer({ week: this.semaine(), recipeId: id }, () => {
      if (this.idProposee() === id) this.idProposee.set(null);
    });
  }

  protected async retirer(id: string, libelle: string): Promise<void> {
    const confirme = await this.confirmation.confirm({
      title: `Retirer «\u00a0${libelle}\u00a0» ?`,
      description:
        'Le Souhait ne sera plus demandé à la génération de la semaine.',
      confirmLabel: 'Retirer le souhait',
      destructive: true,
    });
    if (!confirme) return;

    this.retrait.set(id);
    this.refus.set(null);
    this.service.retirer(id).subscribe({
      next: () => {
        this.retrait.set(null);
        showToast({
          message: `«\u00a0${libelle}\u00a0» est retiré des souhaits.`,
        });
        this.lecture.reload();
      },
      error: (erreur: ErreurApi) => {
        this.retrait.set(null);
        this.refus.set(erreur);
        this.lecture.reload();
      },
    });
  }

  private deposer(saisie: MealWishInput, apres?: () => void): void {
    this.envoi.set(true);
    this.refus.set(null);
    this.service.deposer(saisie).subscribe({
      next: (souhait) => {
        this.envoi.set(false);
        apres?.();
        showToast({
          tone: 'success',
          message: `«\u00a0${intitule(souhait)}\u00a0» est souhaité pour la semaine.`,
        });
        this.lecture.reload();
      },
      error: (erreur: ErreurApi) => {
        this.envoi.set(false);
        this.refus.set(erreur);
      },
    });
  }
}
