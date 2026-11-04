import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { HlmTooltip } from '@personal-os/ui/tooltip';
import { classes } from '@personal-os/ui/utils';
import {
  DccmNavItem,
  dccmNavEntryIsReachable,
  type DccmNavEntry,
  type DccmNavGroup,
} from '../nav-item/nav-item';

/** `full` : la Sidebar de 240 px ; `rail` : le Rail de 72 px, icônes seules. */
export type DccmSidebarVariant = 'full' | 'rail';

/** La pastille d'état du pied : un point coloré et son libellé. */
export interface DccmStatus {
  label: string;
  /** `success` : en ligne ; `error` : hors ligne ; `neutral` : pas encore su. */
  tone: 'success' | 'error' | 'neutral';
}

const pointDeStatut: Record<DccmStatus['tone'], string> = {
  success: 'bg-secondary',
  error: 'bg-error',
  neutral: 'bg-outline',
};

let suivant = 0;

/**
 * Les masters `Sidebar` (240 px) et `Rail` (72 px) : les groupes de la
 * navigation, puis au pied « Aide et support » et la pastille d'état.
 *
 * Une entrée avec un chemin est un lien, actif quand son écran est affiché ;
 * une entrée sans chemin, ou `comingSoon`, est « À venir ». En rail, les
 * libellés passent en infobulle et restent lus par les lecteurs d'écran.
 */
@Component({
  selector: 'dccm-sidebar',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    RouterLinkActive,
    DccmNavItem,
    HlmTooltip,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-slot': 'sidebar',
    role: 'navigation',
    '[attr.aria-label]': 'ariaLabel()',
    '[attr.data-variant]': 'variant()',
  },
  template: `
    <!-- Les groupes défilent sous un pied fixe, sans barre de défilement
         visible (comme le master) : elle rognerait la largeur des entrées. -->
    <div
      class="-mx-space-sm flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-space-sm [scrollbar-width:none]"
      [class]="_rail() ? 'items-center gap-space-md' : 'gap-gutter'"
    >
      @for (groupe of groups(); track groupe.label; let i = $index) {
        <div
          class="flex flex-col gap-1"
          [class.items-center]="_rail()"
          [class]="
            _rail() && i > 0
              ? 'border-t border-surface-container-highest pt-space-md'
              : ''
          "
        >
          <p
            [id]="_id + '-' + i"
            class="px-space-sm py-1 text-label-micro tracking-widest text-outline uppercase"
            [class.sr-only]="_rail()"
          >
            {{ groupe.label }}
          </p>
          <ul
            [attr.aria-labelledby]="_id + '-' + i"
            class="flex flex-col gap-0.5"
          >
            @for (entree of groupe.entries; track entree.label) {
              <li>
                <ng-container
                  *ngTemplateOutlet="entreeDeNavigation; context: { $implicit: entree }"
                />
              </li>
            }
          </ul>
        </div>
      }
    </div>

    <div
      class="flex shrink-0 flex-col gap-space-sm border-t border-surface-container-highest"
      [class]="_rail() ? 'items-center pt-space-md' : 'pt-space-sm'"
    >
      @if (footer().length) {
        <ul class="flex flex-col gap-0.5" [class.w-full]="!_rail()">
          @for (entree of footer(); track entree.label) {
            <li>
              <ng-container
                *ngTemplateOutlet="entreeDeNavigation; context: { $implicit: entree }"
              />
            </li>
          }
        </ul>
      }
      @if (status(); as statut) {
        <div
          role="status"
          class="flex items-center rounded bg-surface-container-low"
          [class]="_rail() ? 'h-8 w-12 justify-center' : 'gap-1.5 px-2.5 py-2'"
          [hlmTooltip]="statut.label"
          position="right"
          [tooltipDisabled]="!_rail()"
        >
          <span
            class="size-2 shrink-0 rounded-full"
            [class]="_point()"
            aria-hidden="true"
          ></span>
          <span
            class="text-label-micro tracking-normal text-on-surface-variant"
            [class.sr-only]="_rail()"
            >{{ statut.label }}</span
          >
        </div>
      }
    </div>

    <ng-template #entreeDeNavigation let-entree>
      @if (_atteignable(entree)) {
        <a
          dccmNavItem
          [routerLink]="entree.link"
          routerLinkActive
          #lien="routerLinkActive"
          [routerLinkActiveOptions]="{ exact: entree.link === '/' }"
          [active]="lien.isActive"
          [icon]="entree.icon"
          [label]="entree.label"
          [compact]="_rail()"
          [hlmTooltip]="entree.label"
          position="right"
          [tooltipDisabled]="!_rail()"
          (click)="navigate.emit()"
        ></a>
      } @else {
        <span
          dccmNavItem
          comingSoon
          [icon]="entree.icon"
          [label]="entree.label"
          [compact]="_rail()"
          [hlmTooltip]="entree.label + ' · à venir'"
          position="right"
          [tooltipDisabled]="!_rail()"
        ></span>
      }
    </ng-template>
  `,
})
export class DccmSidebar {
  /** Les groupes de la navigation, dans l'ordre du master. */
  readonly groups = input.required<readonly DccmNavGroup[]>();
  /** Les entrées du pied (« Aide et support »). */
  readonly footer = input<readonly DccmNavEntry[]>([]);
  /** `full` (240 px, libellés) ou `rail` (72 px, libellés en infobulle). */
  readonly variant = input<DccmSidebarVariant>('full');
  /** La pastille d'état du pied ; aucune quand elle est nulle. */
  readonly status = input<DccmStatus | null>(null);
  /** Le nom du repère de navigation, qui porte aussi le pied. */
  readonly ariaLabel = input('Navigation principale', { alias: 'aria-label' });
  /** Un lien a été suivi : un panneau qui porte la Sidebar se referme. */
  readonly navigate = output<void>();

  protected readonly _id = `dccm-sidebar-${++suivant}`;
  protected readonly _rail = computed(() => this.variant() === 'rail');
  protected readonly _point = computed(
    () => pointDeStatut[this.status()?.tone ?? 'neutral'],
  );
  protected readonly _atteignable = dccmNavEntryIsReachable;

  constructor() {
    classes(() => [
      'flex h-full shrink-0 flex-col gap-space-md bg-surface-container-lowest',
      this._rail() ? 'w-18 items-center p-space-md' : 'w-60 px-space-sm py-space-md',
    ]);
  }
}
