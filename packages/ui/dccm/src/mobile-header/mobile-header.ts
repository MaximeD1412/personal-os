import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { HlmBadge, type BadgeTone } from '@personal-os/ui/badge';
import { classes } from '@personal-os/ui/utils';
import type { DccmStatus } from '../sidebar/sidebar';

const tonDuStatut: Record<DccmStatus['tone'], BadgeTone> = {
  success: 'success',
  error: 'error',
  neutral: 'neutral',
};

/**
 * Le master `MobileHeader` : 56 px en haut de l'écran mobile, fond `surface`
 * à 90 %. La marque « DCCM OS », la pastille d'état, et à droite le bouton de
 * commande projeté (`[dccmMobileHeaderCommand]`).
 */
@Component({
  selector: 'dccm-mobile-header',
  imports: [HlmBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-slot': 'mobile-header', role: 'banner' },
  template: `
    <div class="flex min-w-0 items-center gap-space-sm">
      <span hlmBadge variant="tag" accent class="font-bold">DCCM OS</span>
      @if (status(); as statut) {
        <span
          hlmBadge
          role="status"
          dot
          class="min-w-0 bg-surface-container-low font-medium"
          [tone]="_ton()"
          ><span class="truncate">{{ statut.label }}</span></span
        >
      }
    </div>
    <div class="flex shrink-0 items-center gap-1">
      <ng-content select="[dccmMobileHeaderCommand]" />
    </div>
  `,
})
export class DccmMobileHeader {
  /** La pastille d'état ; aucune quand elle est nulle. */
  readonly status = input<DccmStatus | null>(null);

  protected _ton(): BadgeTone {
    return tonDuStatut[this.status()?.tone ?? 'neutral'];
  }

  constructor() {
    classes(
      () =>
        'flex h-14 items-center justify-between gap-space-sm border-b border-surface-container-highest bg-surface-90 px-margin-mobile backdrop-blur-md',
    );
  }
}
