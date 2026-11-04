import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  aujourdhui,
  zProjectExpenseInput,
  type ApiError,
} from '@personal-os/contracts';
import { DccmFormPage, DccmState, stateOf } from '@personal-os/ui/dccm';
import { HlmFieldImports } from '@personal-os/ui/field';
import { HlmInput } from '@personal-os/ui/input';
import { showToast } from '@personal-os/ui/sonner';
import type { ErreurApi } from '../erreur-api.interceptor';
import { erreursDeChamp, prefillDepuisRequete } from '../formulaire';
import { centimesDepuisSaisie, formaterMontant } from './montant';
import { ProjectService } from './project.service';
import { FIL_DES_PROJETS } from './projects';

/** Ce que l'écran dit d'un montant qu'il ne sait pas lire. */
const MONTANT_ILLISIBLE = 'Un montant en euros, au centime près : 12,50.';

/**
 * L'ajout d'une dépense à un Projet : `/projets/:id/depenses/nouvelle`, qui
 * se préremplit par sa requête (`?label=Papier%20japonais&spentOn=2026-10-12`).
 * Le montant se saisit en euros et part en centimes ; le jour vaut aujourd'hui
 * tant qu'on n'en choisit pas un autre.
 *
 * Rien ne s'enregistre sans « Ajouter la dépense » (ADR 0030).
 */
@Component({
  imports: [DccmFormPage, DccmState, HlmFieldImports, HlmInput],
  templateUrl: './expense-form.html',
})
export class FormulaireDeDepense {
  private readonly router = inject(Router);
  private readonly projets = inject(ProjectService);
  private readonly route = inject(ActivatedRoute).snapshot;

  protected readonly id = this.route.paramMap.get('id') ?? '';
  protected readonly lecture = this.projets.projet(() => this.id);
  protected readonly etat = computed(() => stateOf(this.lecture, () => false));
  private readonly projet = computed(() =>
    this.lecture.hasValue() ? this.lecture.value() : undefined,
  );
  protected readonly fil = computed(() => [
    ...FIL_DES_PROJETS,
    { label: this.projet()?.title ?? '…', link: `/projets/${this.id}` },
    { label: 'Nouvelle dépense' },
  ]);

  protected readonly prefill = prefillDepuisRequete(
    zProjectExpenseInput,
    this.route.queryParamMap,
  );

  protected readonly libelle = signal(this.prefill.valeurs.label ?? '');
  protected readonly montant = signal('');
  protected readonly jour = signal(
    this.prefill.valeurs.spentOn ?? aujourdhui(),
  );

  protected readonly envoi = signal(false);
  protected readonly refus = signal<ApiError | null>(null);
  protected readonly erreurs = computed(() => erreursDeChamp(this.refus()));

  protected valeur(evenement: Event): string {
    return (evenement.target as HTMLInputElement).value;
  }

  protected enregistrer(): void {
    const cents = centimesDepuisSaisie(this.montant());
    if (cents === null) {
      // Une saisie illisible n'a pas de centimes à envoyer : l'écran le dit
      // lui-même, sous le champ, comme l'API dirait un refus.
      this.refus.set({
        status: 400,
        code: 'request.invalid',
        message: MONTANT_ILLISIBLE,
        fields: [
          { path: 'amount.cents', code: 'custom', message: MONTANT_ILLISIBLE },
        ],
      });
      return;
    }

    this.envoi.set(true);
    this.refus.set(null);
    this.projets
      .ajouterUneDepense(this.id, {
        label: this.libelle(),
        amount: { cents, currency: 'EUR' },
        spentOn: this.jour(),
      })
      .subscribe({
        next: (depense) => {
          this.envoi.set(false);
          showToast({
            message: `«\u00a0${depense.label}\u00a0» (${formaterMontant(depense.amount)}) est ajoutée.`,
          });
          void this.router.navigate(['/projets', this.id]);
        },
        error: (erreur: ErreurApi) => {
          this.envoi.set(false);
          this.refus.set(erreur);
        },
      });
  }

  protected fermer(): void {
    void this.router.navigate(['/projets', this.id]);
  }
}
