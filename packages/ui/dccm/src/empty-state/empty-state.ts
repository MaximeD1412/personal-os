import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import {
  matErrorOutline,
  matInboxOutline,
} from '@ng-icons/material-symbols/outline';
import { classes } from '@personal-os/ui/utils';

export type DccmEmptyStateVariant = 'empty' | 'error';

const pastilles: Record<DccmEmptyStateVariant, string> = {
  empty: 'bg-surface-container-lowest text-outline',
  error: 'bg-error-20 text-error',
};

const icones: Record<DccmEmptyStateVariant, string> = {
  empty: matInboxOutline,
  error: matErrorOutline,
};

/**
 * Le master `EmptyState` de la planche `05 Feedback`, et l'`ErrorState` que la
 * galerie en tire : pastille ronde et icône 32, titre `title-sm`, description
 * `body-dense` `outline`, une action principale projetée (un `hlmBtn` ; en
 * erreur, `variant="secondary"`).
 *
 * L'icône est un SVG de `@ng-icons/material-symbols/outline`
 * (`matFitnessCenterOutline`) ; par défaut, celle de la variante.
 */
@Component({
  selector: 'dccm-empty-state',
  imports: [NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-slot': 'empty-state',
    '[attr.data-variant]': 'variant()',
  },
  template: `
    <span
      class="flex size-14 items-center justify-center rounded-full"
      [class]="_pastille()"
      aria-hidden="true"
    >
      <ng-icon [svg]="_icone()" class="icon-xl" />
    </span>
    <p class="text-title-sm text-on-surface">{{ heading() }}</p>
    @if (description()) {
      <p class="max-w-80 text-body-dense text-outline">{{ description() }}</p>
    }
    <div class="mt-1 flex flex-wrap justify-center gap-space-sm empty:hidden">
      <ng-content />
    </div>
  `,
})
export class DccmEmptyState {
  public readonly variant = input<DccmEmptyStateVariant>('empty');
  public readonly heading = input.required<string>();
  public readonly description = input<string>();
  /** Le SVG de l'icône ; par défaut, celui de la variante. */
  public readonly icon = input<string>();

  protected readonly _pastille = computed(() => pastilles[this.variant()]);
  protected readonly _icone = computed(
    () => this.icon() ?? icones[this.variant()],
  );

  constructor() {
    classes(
      () =>
        'flex flex-col items-center gap-space-md rounded-md border border-surface-container-highest bg-surface-container px-gutter py-8 text-center',
    );
  }
}
