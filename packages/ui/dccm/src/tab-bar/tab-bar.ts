import type { BooleanInput } from '@angular/cdk/coercion';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { classes } from '@personal-os/ui/utils';
import {
  dccmNavEntryIsReachable,
  type DccmNavEntry,
} from '../nav-item/nav-item';

/**
 * Le master `TabBarItem` : icône 24, libellé 11, une cible de 64 × 48 (au
 * moins 56 × 44). Sur un lien, il mène à l'écran ; sur un bouton, il agit
 * (« Plus ») ; sur un `span` `comingSoon`, il annonce un écran à venir.
 */
@Component({
  // L'élément porteur dit ce qu'est l'entrée (lien, bouton, à venir) : un
  // sélecteur d'attribut, comme `hlmBtn`.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'a[dccmTabBarItem], button[dccmTabBarItem], span[dccmTabBarItem]',
  imports: [NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-slot': 'tab-bar-item',
    '[attr.data-active]': 'active() && !comingSoon()',
    '[attr.aria-current]': 'active() && !comingSoon() ? "page" : null',
    '[attr.aria-disabled]': 'comingSoon() ? "true" : null',
  },
  template: `
    <ng-icon [name]="icon()" class="icon-lg" aria-hidden="true" />
    <span class="text-label-micro tracking-normal">{{ label() }}</span>
    @if (comingSoon()) {
      <span class="sr-only">(à venir)</span>
    }
  `,
})
export class DccmTabBarItem {
  /** Le nom d'une icône Material Symbols fournie par l'application. */
  readonly icon = input.required<string>();
  readonly label = input.required<string>();
  /** L'onglet de l'écran affiché : icône et libellé `primary`, libellé 600. */
  readonly active = input<boolean, BooleanInput>(false, {
    transform: booleanAttribute,
  });
  /** L'écran n'existe pas encore : estompé, rien à cliquer. */
  readonly comingSoon = input<boolean, BooleanInput>(false, {
    transform: booleanAttribute,
  });

  constructor() {
    classes(() => [
      'flex h-12 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded text-on-surface-variant outline-none',
      'transition-[color,background-color,box-shadow,scale]',
      'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
      'data-[active=true]:text-primary data-[active=true]:[&>span]:font-semibold',
      this.comingSoon()
        ? 'cursor-default opacity-40'
        : 'cursor-pointer active:scale-98 active:bg-surface-container',
    ]);
  }
}

/**
 * Le master `MobileTabBar` : 64 px en bas de l'écran mobile, fond `surface` à
 * 90 %. Les onglets reçus d'abord, puis ceux qui sont projetés (« Plus »).
 */
@Component({
  selector: 'dccm-tab-bar',
  imports: [RouterLink, RouterLinkActive, DccmTabBarItem],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-slot': 'tab-bar' },
  template: `
    <nav
      [attr.aria-label]="ariaLabel()"
      class="flex h-16 items-center justify-around px-1"
    >
      @for (entree of entries(); track entree.label) {
        @if (_atteignable(entree)) {
          <a
            dccmTabBarItem
            [routerLink]="entree.link"
            routerLinkActive
            #lien="routerLinkActive"
            [routerLinkActiveOptions]="{ exact: entree.link === '/' }"
            [active]="lien.isActive"
            [icon]="entree.icon"
            [label]="entree.label"
          ></a>
        } @else {
          <span
            dccmTabBarItem
            comingSoon
            [icon]="entree.icon"
            [label]="entree.label"
          ></span>
        }
      }
      <ng-content />
    </nav>
  `,
})
export class DccmTabBar {
  /** Les onglets, dans l'ordre ; une entrée sans chemin est « À venir ». */
  readonly entries = input.required<readonly DccmNavEntry[]>();
  /** Le nom du repère de navigation. */
  readonly ariaLabel = input('Navigation rapide', { alias: 'aria-label' });

  protected readonly _atteignable = dccmNavEntryIsReachable;

  constructor() {
    classes(
      () =>
        'block border-t border-surface-container-highest bg-surface-90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md',
    );
  }
}
