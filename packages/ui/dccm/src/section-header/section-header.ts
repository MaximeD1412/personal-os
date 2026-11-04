import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Le master `SectionHeader` : le titre d'une section de page en
 * `headline-md`, sa description, et une zone de fin projetée (un lien, un
 * bouton secondaire).
 */
@Component({
  selector: 'dccm-section-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-slot': 'section-header',
    class: 'flex flex-wrap items-end justify-between gap-space-md',
  },
  template: `
    <div class="flex min-w-0 flex-col gap-0.5">
      <h2 class="text-headline-md text-on-surface">{{ heading() }}</h2>
      @if (description()) {
        <p class="text-body-dense text-outline">{{ description() }}</p>
      }
    </div>
    <div class="flex items-center gap-space-sm empty:hidden"><ng-content /></div>
  `,
})
export class DccmSectionHeader {
  /** Le titre de la section. */
  readonly heading = input.required<string>();
  /** La ligne sous le titre. */
  readonly description = input<string>();
}
