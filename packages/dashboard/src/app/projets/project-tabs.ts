import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matLockOutline,
  matPublicOutline,
} from '@ng-icons/material-symbols/outline';
import {
  toggleGroupItemVariants,
  toggleGroupVariants,
} from '@personal-os/ui/toggle-group';

/**
 * Les deux faces d'un Projet, chacune à son URL : sa fiche privée (dépenses,
 * notes, liens) et sa Présentation publique. Des liens, dessinés comme le
 * SegmentedControl : l'onglet actif est la page affichée.
 */
@Component({
  selector: 'pos-project-tabs',
  imports: [RouterLink, RouterLinkActive, NgIcon],
  providers: [provideIcons({ matLockOutline, matPublicOutline })],
  template: `
    <nav aria-label="Sections du projet" [class]="groupe">
      <a
        data-test="onglet-fiche"
        routerLinkActive
        #fiche="routerLinkActive"
        [routerLink]="['/projets', projectId()]"
        [routerLinkActiveOptions]="{ exact: true }"
        [attr.data-state]="fiche.isActive ? 'on' : 'off'"
        [attr.aria-current]="fiche.isActive ? 'page' : null"
        [class]="segment"
      >
        <ng-icon name="matLockOutline" aria-hidden="true" />
        Fiche
      </a>
      <a
        data-test="onglet-presentation"
        routerLinkActive
        #presentation="routerLinkActive"
        [routerLink]="['/projets', projectId(), 'presentation']"
        [attr.data-state]="presentation.isActive ? 'on' : 'off'"
        [attr.aria-current]="presentation.isActive ? 'page' : null"
        [class]="segment"
      >
        <ng-icon name="matPublicOutline" aria-hidden="true" />
        Présentation publique
      </a>
    </nav>
  `,
})
export class OngletsDuProjet {
  readonly projectId = input.required<string>();

  protected readonly groupe = toggleGroupVariants({ size: 'md' });
  protected readonly segment = toggleGroupItemVariants({ size: 'md' });
}
