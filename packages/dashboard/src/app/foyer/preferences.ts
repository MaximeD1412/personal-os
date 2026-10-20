import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matAddOutline,
  matBlockOutline,
  matCloseOutline,
  matHealthAndSafetyOutline,
  matSentimentDissatisfiedOutline,
} from '@ng-icons/material-symbols/outline';
import {
  FOOD_PREFERENCE_KINDS,
  LIBELLES_DES_ALLERGENES,
  type FoodPreference,
  type FoodPreferenceKind,
  type HouseholdMember,
} from '@personal-os/contracts';
import { HlmAlertImports } from '@personal-os/ui/alert';
import { HlmAvatarImports } from '@personal-os/ui/avatar';
import { HlmButton } from '@personal-os/ui/button';
import { HlmCardImports } from '@personal-os/ui/card';
import {
  DccmConfirm,
  DccmListRow,
  DccmPageHeader,
  DccmState,
  stateOf,
  type DccmCrumb,
  type DccmStateStatus,
} from '@personal-os/ui/dccm';
import { showToast } from '@personal-os/ui/sonner';
import type { ErreurApi } from '../erreur-api.interceptor';
import { HouseholdService } from '../household.service';
import { FoodPreferenceService } from './food-preference.service';

/** Le fil d'Ariane des écrans des Préférences alimentaires. */
export const FIL_DES_PREFERENCES: readonly DccmCrumb[] = [
  { label: 'Paramètres' },
  { label: 'Foyer' },
  { label: 'Préférences alimentaires', link: '/foyer/preferences' },
];

/** Une section d'un Compte : un type de Préférence, et sa tonalité. */
interface Section {
  kind: FoodPreferenceKind;
  titre: string;
  icone: string;
  /** La couleur du titre. */
  couleur: string;
  /** La couleur du filet, au début de chaque ligne. */
  filet: string;
  vide: string;
}

const SECTIONS: Readonly<Record<FoodPreferenceKind, Omit<Section, 'kind'>>> = {
  ALLERGY: {
    titre: 'Allergies',
    icone: 'matHealthAndSafetyOutline',
    couleur: 'text-error',
    filet: 'border-error',
    vide: 'Aucune allergie.',
  },
  EXCLUDED: {
    titre: 'Aliments exclus',
    icone: 'matBlockOutline',
    couleur: 'text-tertiary',
    filet: 'border-tertiary',
    vide: 'Aucun aliment exclu.',
  },
  DISLIKED: {
    titre: 'Peu appréciés',
    icone: 'matSentimentDissatisfiedOutline',
    couleur: 'text-outline',
    filet: 'border-outline-variant',
    vide: 'Aucun aliment peu apprécié.',
  },
};

/**
 * Les Préférences alimentaires du Foyer : une colonne par Compte, et dans
 * chacune ses allergies, ses aliments exclus et ses aliments peu appréciés.
 * Les deux Comptes voient et modifient les deux colonnes. L'ajout ouvre le
 * formulaire, prérempli pour le Compte de la colonne ; une suppression se
 * confirme.
 */
@Component({
  imports: [
    RouterLink,
    NgIcon,
    HlmAlertImports,
    HlmAvatarImports,
    HlmButton,
    HlmCardImports,
    DccmListRow,
    DccmPageHeader,
    DccmState,
  ],
  providers: [
    provideIcons({
      matAddOutline,
      matBlockOutline,
      matCloseOutline,
      matHealthAndSafetyOutline,
      matSentimentDissatisfiedOutline,
    }),
  ],
  templateUrl: './preferences.html',
})
export class Preferences {
  private readonly service = inject(FoodPreferenceService);
  private readonly confirmation = inject(DccmConfirm);

  protected readonly fil: readonly DccmCrumb[] = [
    ...FIL_DES_PREFERENCES.slice(0, 2),
    { label: 'Préférences alimentaires' },
  ];

  protected readonly foyer = inject(HouseholdService).foyer();
  protected readonly lecture = this.service.preferences();

  /** L'écran attend le Foyer et ses Préférences ; la première erreur l'emporte. */
  protected readonly etat = computed<DccmStateStatus>(() => {
    const etats = [
      stateOf(this.foyer, () => false),
      stateOf(this.lecture, () => false),
    ];
    if (etats.includes('error')) return 'error';
    return etats.includes('loading') ? 'loading' : 'ready';
  });
  protected readonly erreur = computed(
    () => this.foyer.error() ?? this.lecture.error(),
  );

  /** La Préférence en cours de suppression, le temps de la requête. */
  protected readonly suppression = signal<string | null>(null);
  /** Le refus de la dernière suppression, en bandeau : jamais en toast seul. */
  protected readonly refus = signal<ErreurApi | null>(null);

  /** Chaque Compte du Foyer, avec ses sections dans l'ordre des types. */
  protected readonly colonnes = computed(() => {
    const membres = this.foyer.hasValue()
      ? (this.foyer.value()?.members ?? [])
      : [];
    const preferences = this.lecture.hasValue() ? this.lecture.value() : [];

    return membres.map((membre) => ({
      membre,
      initiale: membre.displayName.trim().charAt(0).toUpperCase(),
      sections: FOOD_PREFERENCE_KINDS.map((kind) => ({
        kind,
        ...SECTIONS[kind],
        preferences: preferences.filter(
          (preference) =>
            preference.userId === membre.id && preference.kind === kind,
        ),
      })),
    }));
  });

  protected recharger(): void {
    this.foyer.reload();
    this.lecture.reload();
  }

  /** Ce que la Préférence vise : l'Allergène, ou l'Ingrédient. */
  protected libelle(preference: FoodPreference): string {
    return preference.target === 'ALLERGEN'
      ? LIBELLES_DES_ALLERGENES[preference.allergen]
      : preference.ingredientDisplayName;
  }

  protected cible(preference: FoodPreference): string {
    return preference.target === 'ALLERGEN' ? 'Allergène' : 'Ingrédient';
  }

  protected async supprimer(
    preference: FoodPreference,
    membre: HouseholdMember,
  ): Promise<void> {
    const libelle = this.libelle(preference);
    const confirme = await this.confirmation.confirm({
      title: `Retirer «\u00a0${libelle}\u00a0» ?`,
      description: `La Préférence de ${membre.displayName} ne s'appliquera plus aux repas.`,
      confirmLabel: 'Retirer la préférence',
      destructive: true,
    });
    if (!confirme) return;

    this.suppression.set(preference.id);
    this.refus.set(null);
    this.service.supprimer(preference.id).subscribe({
      next: () => {
        this.suppression.set(null);
        showToast({
          message: `«\u00a0${libelle}\u00a0» est retiré des préférences de ${membre.displayName}.`,
        });
        this.lecture.reload();
      },
      error: (erreur: ErreurApi) => {
        this.suppression.set(null);
        this.refus.set(erreur);
        this.lecture.reload();
      },
    });
  }
}
