import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matAddOutline,
  matRocketLaunchOutline,
} from '@ng-icons/material-symbols/outline';
import type { ProjectSummary } from '@personal-os/contracts';
import { HlmButton } from '@personal-os/ui/button';
import { HlmCard } from '@personal-os/ui/card';
import {
  DccmListRow,
  DccmPageHeader,
  DccmState,
  stateOf,
  type DccmCrumb,
} from '@personal-os/ui/dccm';
import { formaterMontant } from './montant';
import { ProjectService } from './project.service';

/** Le fil d'Ariane des écrans des Projets. */
export const FIL_DES_PROJETS: readonly DccmCrumb[] = [
  { label: 'Projets', link: '/projets' },
];

const JOUR = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Europe/Paris',
});

/**
 * Les Projets de l'Espace personnel, du plus récemment modifié au plus
 * ancien, chacun avec le total de ses dépenses.
 */
@Component({
  imports: [
    RouterLink,
    NgIcon,
    HlmButton,
    HlmCard,
    DccmListRow,
    DccmPageHeader,
    DccmState,
  ],
  providers: [provideIcons({ matAddOutline })],
  templateUrl: './projects.html',
})
export class Projets {
  protected readonly fil: readonly DccmCrumb[] = [{ label: 'Projets' }];
  protected readonly iconeVide = matRocketLaunchOutline;

  protected readonly lecture = inject(ProjectService).projets();
  protected readonly etat = computed(() =>
    stateOf(this.lecture, (projets) => projets.length === 0),
  );
  /** Ce que la lecture a rendu ; rien quand elle a échoué (lire `value()` lèverait). */
  protected readonly projets = computed(() =>
    this.lecture.hasValue() ? this.lecture.value() : [],
  );

  protected readonly montant = formaterMontant;

  protected modifie(projet: ProjectSummary): string {
    return `Modifié le ${JOUR.format(new Date(projet.updatedAt))}`;
  }
}
