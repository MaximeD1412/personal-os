import type { BooleanInput } from '@angular/cdk/coercion';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { HlmBadge } from '@personal-os/ui/badge';
import { classes } from '@personal-os/ui/utils';
import { cva } from 'class-variance-authority';

/** Une entrée de navigation, telle que la Sidebar, le Rail et la barre d'onglets la reçoivent. */
export interface DccmNavEntry {
  label: string;
  /** Le nom d'une icône Material Symbols fournie par l'application (`provideIcons`). */
  icon: string;
  /** Le chemin de l'écran ; sans chemin, l'entrée est « À venir ». */
  link?: string;
  /** Vrai quand l'écran n'existe pas encore : l'entrée n'est pas cliquable. */
  comingSoon?: boolean;
}

/** Un groupe de la Sidebar (« Organisation », « Système »…). */
export interface DccmNavGroup {
  label: string;
  entries: readonly DccmNavEntry[];
}

/** Une entrée mène quelque part si elle a un chemin et n'est pas « À venir ». */
export function dccmNavEntryIsReachable(
  entry: DccmNavEntry,
): entry is DccmNavEntry & { link: string } {
  return !!entry.link && !entry.comingSoon;
}

const navItemVariants = cva(
  [
    'flex shrink-0 items-center rounded text-on-surface-variant outline-none',
    'transition-[color,background-color,box-shadow]',
    'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
    'data-[active=true]:bg-primary-20 data-[active=true]:text-primary',
  ],
  {
    variants: {
      compact: {
        true: 'h-10 w-12 justify-center [&>span>ng-icon]:icon-md',
        false:
          'h-8 w-full justify-between gap-space-sm px-space-sm text-body-dense font-medium data-[active=true]:font-semibold [&>span>ng-icon]:icon-sm',
      },
      comingSoon: {
        true: 'cursor-default',
        false:
          'cursor-pointer hover:not-data-[active=true]:bg-surface-container hover:not-data-[active=true]:text-on-surface',
      },
    },
    // Le Rail n'a pas la place du badge : l'entrée « À venir » y est estompée.
    compoundVariants: [{ compact: true, comingSoon: true, class: 'opacity-40' }],
  },
);

/**
 * Les masters `NavItem` (Sidebar, icône 18, libellé 13/500) et `RailItem`
 * (`compact` : 48 × 40, icône 20, libellé réservé aux lecteurs d'écran).
 *
 * L'élément qui le porte dit ce qu'il est : `<a dccmNavItem routerLink="…">`
 * mène à un écran, `<span dccmNavItem comingSoon>` annonce un écran à venir —
 * badge « À venir », ni lien ni tabulation.
 */
@Component({
  // L'élément porteur dit ce qu'est l'entrée (lien, bouton, à venir) : un
  // sélecteur d'attribut, comme `hlmBtn`.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'a[dccmNavItem], span[dccmNavItem]',
  imports: [NgIcon, HlmBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-slot': 'nav-item',
    '[attr.data-active]': 'active() && !comingSoon()',
    '[attr.aria-current]': 'active() && !comingSoon() ? "page" : null',
    '[attr.aria-disabled]': 'comingSoon() ? "true" : null',
  },
  template: `
    <span class="flex min-w-0 items-center gap-space-sm">
      <ng-icon [name]="icon()" aria-hidden="true" />
      @if (compact()) {
        <span class="sr-only"
          >{{ label() }}{{ comingSoon() ? ' (à venir)' : '' }}</span
        >
      } @else {
        <span class="truncate">{{ label() }}</span>
      }
    </span>
    @if (comingSoon() && !compact()) {
      <span hlmBadge tone="warning">À venir</span>
    }
  `,
})
export class DccmNavItem {
  /** Le nom d'une icône Material Symbols fournie par l'application. */
  readonly icon = input.required<string>();
  /** Le libellé ; en mode compact, il n'est lu que par les lecteurs d'écran. */
  readonly label = input.required<string>();
  /** L'entrée de l'écran affiché : fond `primary-20`, `aria-current="page"`. */
  readonly active = input<boolean, BooleanInput>(false, {
    transform: booleanAttribute,
  });
  /** L'écran n'existe pas encore : badge « À venir », rien à cliquer. */
  readonly comingSoon = input<boolean, BooleanInput>(false, {
    transform: booleanAttribute,
  });
  /** Le `RailItem` : l'icône seule, 48 × 40. */
  readonly compact = input<boolean, BooleanInput>(false, {
    transform: booleanAttribute,
  });

  constructor() {
    classes(() =>
      navItemVariants({
        compact: this.compact(),
        comingSoon: this.comingSoon(),
      }),
    );
  }
}
