import {
  ChangeDetectionStrategy,
  Component,
  input,
  model,
  output,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matLogoutOutline,
  matPersonOutline,
} from '@ng-icons/material-symbols/outline';
import { HlmAvatar, HlmAvatarFallback } from '@personal-os/ui/avatar';
import {
  HlmToggleGroup,
  HlmToggleGroupItem,
} from '@personal-os/ui/toggle-group';
import { classes } from '@personal-os/ui/utils';
import { DccmBrand } from './brand';

/** Un Espace tel que le sélecteur le propose. */
export interface DccmScopeOption {
  value: string;
  label: string;
}

/**
 * Le master `TopBar` : 64 px, fond `surface-container-lowest` à 90 % et flou,
 * au-dessus du contenu défilé. À gauche la marque et le sélecteur d'Espace, au
 * centre la zone de recherche (projetée par `[dccmTopBarSearch]`), à droite le
 * compte et sa déconnexion.
 *
 * Le sélecteur ne propose que les Espaces reçus et ne filtre rien : il retient
 * l'Espace pré-choisi pour une création (`[(scope)]`).
 */
@Component({
  selector: 'dccm-top-bar',
  imports: [
    NgIcon,
    HlmAvatar,
    HlmAvatarFallback,
    HlmToggleGroup,
    HlmToggleGroupItem,
    DccmBrand,
  ],
  viewProviders: [provideIcons({ matLogoutOutline, matPersonOutline })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-slot': 'top-bar', role: 'banner' },
  template: `
    <div class="flex shrink-0 items-center gap-space-md">
      <dccm-brand />
      @if (scopes().length) {
        <hlm-toggle-group
          size="md"
          [aria-label]="scopeLabel()"
          [(value)]="scope"
        >
          @for (espace of scopes(); track espace.value) {
            <button
              hlmToggleGroupItem
              class="text-label-micro tracking-normal data-[state=on]:font-bold"
              [value]="espace.value"
            >
              {{ espace.label }}
            </button>
          }
        </hlm-toggle-group>
      }
    </div>

    <div class="flex min-w-0 flex-1 justify-center">
      <ng-content select="[dccmTopBarSearch]" />
    </div>

    @if (userName(); as nom) {
      <div
        class="flex shrink-0 items-center gap-space-sm rounded-md bg-surface-container-low px-space-sm py-1"
      >
        <hlm-avatar>
          <span hlmAvatarFallback
            ><ng-icon name="matPersonOutline" aria-hidden="true"
          /></span>
        </hlm-avatar>
        <span
          class="max-w-40 truncate text-label-regular font-semibold text-on-surface"
          >{{ nom }}</span
        >
        <button
          type="button"
          data-slot="top-bar-logout"
          class="flex h-6 cursor-pointer items-center gap-1 rounded px-space-sm text-label-micro tracking-normal text-outline outline-none transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:ring-2 focus-visible:ring-primary active:scale-98 [&>ng-icon]:icon-xs"
          (click)="logout.emit()"
        >
          <ng-icon name="matLogoutOutline" aria-hidden="true" />
          Déconnexion
        </button>
      </div>
    }
  `,
})
export class DccmTopBar {
  /** Les Espaces que le compte atteint, tels que l'API les renvoie. */
  readonly scopes = input<readonly DccmScopeOption[]>([]);
  /** L'Espace pré-choisi pour une création. */
  readonly scope = model<string | null>(null);
  /** Le nom du sélecteur, lu par les lecteurs d'écran. */
  readonly scopeLabel = input('Espace des nouvelles saisies');
  /** Le nom du compte connecté ; sans nom, le bloc compte n'apparaît pas. */
  readonly userName = input<string | null>(null);
  /** Le bouton « Déconnexion » a été pressé. */
  readonly logout = output<void>();

  constructor() {
    classes(
      () =>
        'flex h-16 items-center justify-between gap-gutter border-b border-surface-container-highest bg-surface-container-lowest-90 px-margin shadow-top-bar backdrop-blur-md',
    );
  }
}
