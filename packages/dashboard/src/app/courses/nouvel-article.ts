import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { matShoppingCartOutline } from '@ng-icons/material-symbols/outline';
import {
  type ShoppingListItemInput,
  zShoppingListItemInput,
} from '@personal-os/contracts';
import { HlmButton } from '@personal-os/ui/button';
import {
  DccmFormPage,
  DccmListRow,
  DccmState,
  stateOf,
} from '@personal-os/ui/dccm';
import { HlmFieldImports } from '@personal-os/ui/field';
import { HlmInputImports } from '@personal-os/ui/input';
import { showToast } from '@personal-os/ui/sonner';
import * as z from 'zod';
import type { ErreurApi } from '../erreur-api.interceptor';
import { erreursDeChamp, prefillDepuisRequete } from '../formulaire';
import { FIL_DES_COURSES, nomDeListe } from './courses';
import { ShoppingListService } from './shopping-list.service';

/**
 * Ce que le lien préremplit : un libellé et sa quantité. L'Ingrédient du
 * catalogue se cherche depuis la liste elle-même, pas depuis un lien.
 */
const zPrefill = z.object({
  label: zShoppingListItemInput.shape.label,
  quantity: zShoppingListItemInput.shape.quantity,
});

/**
 * L'ajout d'un Article à la Liste de courses ouverte :
 * `/courses/articles/nouveau?label=Lait&quantity=2`. La barre de commande y
 * mène (ADR 0018) : elle ne connaît pas la liste, l'écran la choisit. Une
 * seule liste ouverte est visée d'office ; parmi plusieurs, la plus récente
 * est proposée et les autres restent au choix. Sans liste ouverte, rien ne
 * s'envoie : une liste se produit depuis le planning de repas arrêté.
 *
 * Rien ne s'enregistre sans « Ajouter à la liste » (ADR 0030).
 */
@Component({
  imports: [
    RouterLink,
    HlmButton,
    DccmFormPage,
    DccmListRow,
    DccmState,
    HlmFieldImports,
    HlmInputImports,
  ],
  templateUrl: './nouvel-article.html',
})
export class NouvelArticle {
  private readonly router = inject(Router);
  private readonly service = inject(ShoppingListService);

  protected readonly iconeVide = matShoppingCartOutline;
  protected readonly nomDeListe = nomDeListe;

  protected readonly prefill = prefillDepuisRequete(
    zPrefill,
    inject(ActivatedRoute).snapshot.queryParamMap,
  );

  protected readonly libelle = signal(this.prefill.valeurs.label ?? '');
  protected readonly quantite = signal<number | null>(
    this.prefill.valeurs.quantity ?? null,
  );

  protected readonly ouvertes = this.service.ouvertes();
  protected readonly etat = computed(() =>
    stateOf(this.ouvertes, (listes) => listes.length === 0),
  );
  protected readonly listes = computed(() =>
    this.ouvertes.hasValue() ? this.ouvertes.value() : [],
  );
  /** La liste choisie à la main ; sinon la plus récente des ouvertes. */
  private readonly choisie = signal<string | null>(null);
  protected readonly visee = computed(() => {
    const listes = this.listes();
    return (
      listes.find(({ id }) => id === this.choisie()) ?? listes[0] ?? null
    );
  });

  protected readonly envoi = signal(false);
  protected readonly refus = signal<ErreurApi | null>(null);
  protected readonly erreurs = computed(() => erreursDeChamp(this.refus()));

  protected readonly fil = [
    ...FIL_DES_COURSES,
    { label: 'Ajouter un article' },
  ];

  protected choisir(id: string): void {
    this.choisie.set(id);
  }

  protected saisirLeLibelle(evenement: Event): void {
    this.libelle.set((evenement.target as HTMLInputElement).value);
  }

  protected saisirLaQuantite(evenement: Event): void {
    const champ = evenement.target as HTMLInputElement;
    this.quantite.set(
      champ.value === '' || Number.isNaN(champ.valueAsNumber)
        ? null
        : champ.valueAsNumber,
    );
  }

  protected enregistrer(): void {
    const liste = this.visee();
    if (!liste) return;
    const quantite = this.quantite();
    // Le libellé part tel quel : l'API dit ce qui ne va pas.
    const saisie: ShoppingListItemInput = {
      label: this.libelle(),
      ...(quantite === null ? {} : { quantity: quantite }),
    };

    this.envoi.set(true);
    this.refus.set(null);
    this.service.ajouter(liste.id, saisie).subscribe({
      next: (article) => {
        this.envoi.set(false);
        showToast({
          message: `«\u00a0${article.label ?? saisie.label}\u00a0» ajouté à la liste.`,
        });
        void this.router.navigate(['/courses', liste.id]);
      },
      error: (erreur: ErreurApi) => {
        this.envoi.set(false);
        this.refus.set(erreur);
      },
    });
  }

  protected fermer(): void {
    void this.router.navigate(['/courses']);
  }
}
