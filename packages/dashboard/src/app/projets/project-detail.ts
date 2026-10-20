import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matAddOutline,
  matDeleteOutline,
  matEditOutline,
  matOpenInNewOutline,
} from '@ng-icons/material-symbols/outline';
import type { ProjectExpense } from '@personal-os/contracts';
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
} from '@personal-os/ui/dccm';
import { showToast } from '@personal-os/ui/sonner';
import { HlmTableImports } from '@personal-os/ui/table';
import type { ErreurApi } from '../erreur-api.interceptor';
import { rendreLeMarkdown } from './markdown';
import { formaterJour, formaterMontant } from './montant';
import { ProjectService } from './project.service';
import { FIL_DES_PROJETS } from './projects';

/**
 * La fiche d'un Projet : ses dépenses et leur total, ses notes rendues depuis
 * le markdown, ses liens. « Modifier » et « Ajouter une dépense » mènent à
 * leur formulaire ; supprimer le Projet ou retirer une dépense se confirme.
 */
@Component({
  imports: [
    RouterLink,
    NgIcon,
    HlmAlertImports,
    HlmBadge,
    HlmButton,
    HlmCardImports,
    HlmTableImports,
    DccmPageHeader,
    DccmState,
  ],
  providers: [
    provideIcons({
      matAddOutline,
      matDeleteOutline,
      matEditOutline,
      matOpenInNewOutline,
    }),
  ],
  templateUrl: './project-detail.html',
})
export class FicheDeProjet {
  private readonly router = inject(Router);
  private readonly projets = inject(ProjectService);
  private readonly confirmation = inject(DccmConfirm);

  protected readonly id =
    inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
  protected readonly lecture = this.projets.projet(() => this.id);
  protected readonly etat = computed(() => stateOf(this.lecture, () => false));
  /** Le Projet lu ; rien quand la lecture a échoué (lire `value()` lèverait). */
  protected readonly projet = computed(() =>
    this.lecture.hasValue() ? this.lecture.value() : undefined,
  );

  protected readonly titre = computed(() => this.projet()?.title ?? 'Projet');
  protected readonly fil = computed((): DccmCrumb[] => [
    ...FIL_DES_PROJETS,
    { label: this.titre() },
  ]);
  protected readonly notes = computed(() =>
    rendreLeMarkdown(this.projet()?.notes ?? ''),
  );

  protected readonly montant = formaterMontant;
  protected readonly jour = formaterJour;

  /** Le refus d'une suppression ou d'un retrait, montré au-dessus de la fiche. */
  protected readonly refus = signal<ErreurApi | null>(null);
  protected readonly envoi = signal(false);

  protected async supprimer(): Promise<void> {
    const projet = this.projet();
    if (!projet) return;

    const confirme = await this.confirmation.confirm({
      title: `Supprimer le projet «\u00a0${projet.title}\u00a0» ?`,
      description:
        'Ses notes, ses liens et ses dépenses sont supprimés avec lui.',
      confirmLabel: 'Supprimer le projet',
      destructive: true,
    });
    if (!confirme) return;

    this.envoyer(this.projets.supprimer(projet.id), () => {
      showToast({ message: `«\u00a0${projet.title}\u00a0» est supprimé.` });
      void this.router.navigate(['/projets']);
    });
  }

  protected async retirer(depense: ProjectExpense): Promise<void> {
    const confirme = await this.confirmation.confirm({
      title: `Retirer la dépense «\u00a0${depense.label}\u00a0» ?`,
      description: `${formaterMontant(depense.amount)} sortira du total du projet.`,
      confirmLabel: 'Retirer la dépense',
      destructive: true,
    });
    if (!confirme) return;

    this.envoyer(this.projets.retirerUneDepense(this.id, depense.id), () => {
      showToast({ message: `«\u00a0${depense.label}\u00a0» est retirée.` });
      this.lecture.reload();
    });
  }

  private envoyer(
    requete: ReturnType<ProjectService['supprimer']>,
    reussite: () => void,
  ): void {
    this.envoi.set(true);
    this.refus.set(null);
    requete.subscribe({
      next: () => {
        this.envoi.set(false);
        reussite();
      },
      error: (erreur: ErreurApi) => {
        this.envoi.set(false);
        this.refus.set(erreur);
      },
    });
  }
}
