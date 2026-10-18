import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matArrowForwardOutline } from '@ng-icons/material-symbols/outline';
import { HlmCard } from '@personal-os/ui/card';
import { classes } from '@personal-os/ui/utils';

/** La couleur du pilier, portée par l'icône (docs/design-system.md). */
export type DccmKpiTileTone = 'primary' | 'secondary' | 'tertiary' | 'outline';

const teintesDIcone: Record<DccmKpiTileTone, string> = {
  primary: 'bg-primary-20 text-primary',
  secondary: 'bg-secondary-15 text-secondary',
  tertiary: 'bg-tertiary-15 text-tertiary',
  outline: 'bg-surface-container-high text-outline',
};

/**
 * Le master `KpiTile` : une carte de métrique (hauteur min 140), icône de
 * pilier, sur-titre, valeur en chiffres tabulaires, méta, puis un pied qui
 * porte le statut et le libellé du lien.
 *
 * Posée sur un lien (`<a dccmKpiTile routerLink="…">`), toute la tuile mène au
 * module et une flèche le dit. Le statut est un texte (`status`), ou un
 * `hlmBadge` projeté quand il a un sens (en attente, alerte…).
 */
@Component({
  selector: 'dccm-kpi-tile, a[dccmKpiTile]',
  imports: [NgIcon],
  hostDirectives: [HlmCard],
  viewProviders: [provideIcons({ matArrowForwardOutline })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-slot': 'kpi-tile' },
  template: `
    <div class="flex items-center justify-between gap-space-sm">
      <div class="flex min-w-0 items-center gap-1.5">
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded"
          [class]="_teinteDIcone()"
        >
          <ng-icon [name]="icon()" class="icon-sm" aria-hidden="true" />
        </span>
        <span
          class="truncate text-label-regular tracking-widest text-outline uppercase"
          >{{ eyebrow() }}</span
        >
      </div>
      @if (_estUnLien) {
        <ng-icon
          name="matArrowForwardOutline"
          class="icon-xs shrink-0 text-outline"
          aria-hidden="true"
        />
      }
    </div>
    <div class="flex flex-col gap-0.5">
      <span class="text-telemetry-metric text-on-surface tabular-nums">{{
        value()
      }}</span>
      @if (meta()) {
        <span class="text-body-dense text-on-surface-variant">{{
          meta()
        }}</span>
      }
    </div>
    <div
      class="flex items-center justify-between gap-space-sm border-t border-surface-container-high pt-1.5 text-label-micro tracking-normal"
    >
      <span class="flex min-w-0 items-center truncate text-outline"
        ><ng-content select="[hlmBadge]">{{ status() }}</ng-content></span
      >
      @if (link()) {
        <span class="shrink-0 text-primary">{{ link() }}</span>
      }
    </div>
  `,
})
export class DccmKpiTile {
  /** Le nom d'une icône Material Symbols fournie par l'écran (`provideIcons`). */
  readonly icon = input.required<string>();
  /** Le sur-titre, le nom du pilier ou de la métrique (écrit en capitales). */
  readonly eyebrow = input.required<string>();
  /** La valeur, en `telemetry-metric`. */
  readonly value = input.required<string>();
  /** La ligne sous la valeur. */
  readonly meta = input<string>();
  /** Le statut, en texte, à gauche du pied. */
  readonly status = input<string>();
  /** Le libellé du lien, à droite du pied (« Voir liste »). */
  readonly link = input<string>();
  /** La couleur du pilier. */
  readonly tone = input<DccmKpiTileTone>('primary');

  protected readonly _estUnLien =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.tagName === 'A';

  protected _teinteDIcone(): string {
    return teintesDIcone[this.tone()];
  }

  constructor() {
    classes(() => [
      'min-h-35 justify-between',
      this._estUnLien &&
        'transition-colors outline-none hover:bg-surface-container-high focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary-20',
    ]);
  }
}
