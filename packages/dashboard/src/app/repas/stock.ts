import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matAddOutline,
  matDeleteOutline,
  matInventory2Outline,
  matSearchOutline,
} from '@ng-icons/material-symbols/outline';
import {
  aujourdhui,
  normaliserLibelle,
  type PantryItem,
  type PantryItemInput,
} from '@personal-os/contracts';
import { HlmAlertImports } from '@personal-os/ui/alert';
import { HlmBadge } from '@personal-os/ui/badge';
import { HlmButton } from '@personal-os/ui/button';
import { HlmCardImports } from '@personal-os/ui/card';
import {
  DccmConfirm,
  DccmPageHeader,
  DccmState,
  stateOf,
  type DccmCrumb,
  type DccmStateStatus,
} from '@personal-os/ui/dccm';
import { HlmFieldImports } from '@personal-os/ui/field';
import { HlmInputImports } from '@personal-os/ui/input';
import { showToast } from '@personal-os/ui/sonner';
import { HlmTableImports } from '@personal-os/ui/table';
import type { ErreurApi } from '../erreur-api.interceptor';
import { erreursDeChamp } from '../formulaire';
import { Largeur, TABLETTE } from '../largeur';
import { PantryItemService } from './pantry-item.service';
import { alerteDePeremption } from './peremption';
import { quantiteCanonique, UNITES_CANONIQUES } from './quantite';

/** Le fil d'Ariane des écrans du stock. */
export const FIL_DU_STOCK: readonly DccmCrumb[] = [
  { label: 'Repas' },
  { label: 'Stock', link: '/repas/stock' },
];

/** Le refus de la dernière correction : la ligne et le champ qu'il vise. */
interface Refus {
  ingredientId: string;
  champ: 'quantity' | 'expiresOn';
  message: string;
}

/**
 * Le Stock domestique : une ligne par Ingrédient, sa quantité en Unité
 * canonique et sa péremption la plus proche, éditables en place (ADR 0013).
 * Une modification s'enregistre à la sortie du champ, sans bouton : c'est la
 * seule exception à `DccmFormPage`, pour un stock corrigé en quelques
 * secondes. La recherche vit dans l'URL (`?q=`) et filtre le stock lu en
 * entier ; l'ajout d'un Ingrédient ouvre son formulaire.
 */
@Component({
  imports: [
    NgTemplateOutlet,
    RouterLink,
    NgIcon,
    HlmAlertImports,
    HlmBadge,
    HlmButton,
    HlmCardImports,
    HlmFieldImports,
    HlmInputImports,
    HlmTableImports,
    DccmPageHeader,
    DccmState,
  ],
  providers: [
    provideIcons({ matAddOutline, matDeleteOutline, matSearchOutline }),
  ],
  templateUrl: './stock.html',
})
export class Stock {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(PantryItemService);
  private readonly confirmation = inject(DccmConfirm);

  protected readonly fil: readonly DccmCrumb[] = [
    FIL_DU_STOCK[0],
    { label: 'Stock' },
  ];
  protected readonly iconeVide = matInventory2Outline;
  /** Au-delà de la tablette, un tableau ; en deçà, une carte par ligne. */
  protected readonly large = inject(Largeur).auMoins(TABLETTE);
  /** Le jour civil de Paris, d'où se comptent les péremptions. */
  private readonly jour = aujourdhui();

  protected readonly recherche = signal(
    this.route.snapshot.queryParamMap.get('q') ?? '',
  );
  protected readonly lecture = this.service.stock();
  /** Ce que la lecture a rendu ; rien quand elle a échoué (lire `value()` lèverait). */
  private readonly lignes = computed(() =>
    this.lecture.hasValue() ? this.lecture.value() : [],
  );
  protected readonly cherche = computed(() => this.recherche().trim());
  protected readonly affichees = computed(() => {
    const cherche = normaliserLibelle(this.cherche());
    return this.lignes().filter(({ ingredient }) =>
      normaliserLibelle(ingredient.displayName).includes(cherche),
    );
  });

  protected readonly etat = computed<DccmStateStatus>(() => {
    const etat = stateOf(this.lecture, (lignes) => lignes.length === 0);
    return etat === 'ready' && this.affichees().length === 0 ? 'empty' : etat;
  });
  protected readonly titreVide = computed(() =>
    this.lignes().length
      ? `Aucune ligne du stock ne correspond à «\u00a0${this.cherche()}\u00a0»`
      : 'Le stock est vide',
  );

  protected readonly refus = signal<Refus | null>(null);
  /** La ligne en cours de suppression, le temps de la requête. */
  protected readonly suppression = signal<string | null>(null);
  /** Le refus de la dernière suppression, en bandeau : jamais en toast seul. */
  protected readonly refusDeSuppression = signal<ErreurApi | null>(null);

  protected chercher(evenement: Event): void {
    const texte = (evenement.target as HTMLInputElement).value;
    this.recherche.set(texte);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: texte.trim() || null },
      replaceUrl: true,
    });
  }

  protected unite(ligne: PantryItem): string {
    return UNITES_CANONIQUES[ligne.ingredient.canonicalUnit];
  }

  protected alerte(ligne: PantryItem): string | null {
    return alerteDePeremption(ligne.expiresOn, this.jour);
  }

  protected refusDe(ligne: PantryItem, champ: Refus['champ']): string | null {
    const refus = this.refus();
    return refus?.ingredientId === ligne.ingredient.id && refus.champ === champ
      ? refus.message
      : null;
  }

  protected changerLaQuantite(ligne: PantryItem, evenement: Event): void {
    const champ = evenement.target as HTMLInputElement;
    // Un champ vide ou illisible part tel quel : l'API dit ce qui ne va pas.
    const quantity =
      champ.value === '' || Number.isNaN(champ.valueAsNumber)
        ? null
        : champ.valueAsNumber;
    this.corriger(ligne, { quantity, expiresOn: ligne.expiresOn });
  }

  protected changerLaPeremption(ligne: PantryItem, evenement: Event): void {
    const expiresOn = (evenement.target as HTMLInputElement).value || null;
    this.corriger(ligne, { quantity: ligne.quantity, expiresOn });
  }

  protected async retirer(ligne: PantryItem): Promise<void> {
    const nom = ligne.ingredient.displayName;
    const confirme = await this.confirmation.confirm({
      title: `Retirer «\u00a0${nom}\u00a0» du stock ?`,
      description:
        'La ligne disparaît du stock. Un Ingrédient épuisé peut aussi garder sa ligne, à zéro.',
      confirmLabel: 'Retirer du stock',
      destructive: true,
    });
    if (!confirme) return;

    this.suppression.set(ligne.ingredient.id);
    this.refusDeSuppression.set(null);
    this.service.supprimer(ligne.ingredient.id).subscribe({
      next: () => {
        this.suppression.set(null);
        showToast({ message: `«\u00a0${nom}\u00a0» est retiré du stock.` });
        this.lecture.reload();
      },
      error: (erreur: ErreurApi) => {
        this.suppression.set(null);
        this.refusDeSuppression.set(erreur);
        this.lecture.reload();
      },
    });
  }

  private corriger(
    ligne: PantryItem,
    saisie: { quantity: number | null; expiresOn: string | null },
  ): void {
    const { id, displayName } = ligne.ingredient;
    this.service.corriger(id, saisie as PantryItemInput).subscribe({
      next: (corrigee) => {
        if (this.refus()?.ingredientId === id) this.refus.set(null);
        this.lecture.update((lignes) =>
          lignes.map((l) => (l.id === corrigee.id ? corrigee : l)),
        );
        showToast({
          message: `«\u00a0${displayName}\u00a0» : ${quantiteCanonique(corrigee.quantity, corrigee.ingredient.canonicalUnit)} en stock.`,
        });
      },
      error: (erreur: ErreurApi) => {
        const champs = erreursDeChamp(erreur);
        const champ =
          champs['expiresOn'] && !champs['quantity'] ? 'expiresOn' : 'quantity';
        this.refus.set({
          ingredientId: id,
          champ,
          message: champs[champ] ?? erreur.message,
        });
        // Un autre Compte a pu changer le stock entre-temps.
        this.lecture.reload();
      },
    });
  }
}
