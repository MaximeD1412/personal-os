import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matDiamondOutline } from '@ng-icons/material-symbols/outline';

/**
 * La marque de la `TopBar` : l'emblème, « DCCM » et « PERSONAL OS ». Le logo
 * du `.pen` est une image absente du dépôt : l'emblème est une icône.
 */
@Component({
  selector: 'dccm-brand',
  imports: [NgIcon],
  viewProviders: [provideIcons({ matDiamondOutline })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-slot': 'brand',
    class: 'flex shrink-0 items-center gap-space-sm',
  },
  template: `
    <span
      class="flex size-8 items-center justify-center rounded bg-surface-container-high text-primary"
      aria-hidden="true"
    >
      <ng-icon name="matDiamondOutline" class="icon-md" />
    </span>
    <span class="flex flex-col">
      <span class="text-title-sm leading-none text-on-surface">DCCM</span>
      <span class="text-label-micro tracking-widest text-primary uppercase"
        >Personal OS</span
      >
    </span>
  `,
})
export class DccmBrand {}
