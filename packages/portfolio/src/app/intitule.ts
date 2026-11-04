import { Component, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

/** La teinte d'un intitulé, d'une section à l'autre. */
export type TonDIntitule = 'primary' | 'secondary' | 'tertiary';

const TONS: Readonly<Record<TonDIntitule, string>> = {
  primary: 'text-primary',
  secondary: 'text-secondary',
  tertiary: 'text-tertiary',
};

/**
 * L'intitulé qui ouvre une section du portfolio : une icône et le nom de la
 * section, en petites capitales. Le titre de la section le suit.
 */
@Component({
  selector: 'pos-intitule',
  imports: [NgIcon],
  host: {
    class: 'inline-flex items-center gap-space-xs text-label-micro uppercase',
    '[class]': 'ton()',
  },
  template: `<ng-icon class="icon-xs" aria-hidden="true" [name]="icone()" />
    <span><ng-content /></span>`,
})
export class Intitule {
  readonly icone = input.required<string>();
  readonly teinte = input<TonDIntitule>('secondary');

  protected ton(): string {
    return TONS[this.teinte()];
  }
}
