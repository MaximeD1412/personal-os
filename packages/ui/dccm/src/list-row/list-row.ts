import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  model,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matChevronRightOutline } from '@ng-icons/material-symbols/outline';
import { HlmCheckbox } from '@personal-os/ui/checkbox';

let prochainId = 0;

/**
 * Le master `ListRow` : une ligne de liste, titre et méta, case à cocher
 * optionnelle, zone de fin projetée (badge, tag, bouton d'icône) et chevron.
 *
 * L'élément qui la porte dit son usage : `<a dccmListRow>` mène quelque part,
 * `<button dccmListRow>` agit, `<dccm-list-row>` ne fait qu'afficher ou porte
 * une case à cocher (`checkable`), qui ne se pose jamais dans un lien ou un
 * bouton.
 */
@Component({
  // Un lien ou un bouton gardent leur élément natif : le focus, Entrée et
  // Espace restent ceux du navigateur.
  selector: 'dccm-list-row, a[dccmListRow], button[dccmListRow]',
  imports: [HlmCheckbox, NgIcon],
  viewProviders: [provideIcons({ matChevronRightOutline })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-slot': 'list-row',
    class:
      'flex w-full items-center gap-2.5 rounded border border-transparent px-space-md py-space-sm text-start transition-colors outline-none hover:bg-surface-container-high focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary-20 data-[selected=true]:border-primary-40 data-[selected=true]:bg-primary-10',
    '[attr.data-checked]': '_coche() ? "true" : null',
    '[attr.data-selected]': 'selected() ? "true" : null',
  },
  template: `
    @if (_avecCase()) {
      <hlm-checkbox
        [inputId]="_idCase"
        [checked]="checked()"
        (checkedChange)="checked.set($event)"
      />
    }
    <span class="flex min-w-0 flex-1 flex-col gap-0.5">
      <!-- Avec une case, le titre en est le libellé : il la nomme, et un clic
           dessus la bascule. -->
      @if (_avecCase()) {
        <label
          data-slot="list-row-title"
          [id]="_idTitre"
          [for]="_idCase"
          class="cursor-pointer truncate text-body-dense font-semibold"
          [class.text-on-surface]="!_coche()"
          [class.line-through]="_coche()"
          [class.text-outline]="_coche()"
          >{{ label() }}</label
        >
      } @else {
        <span
          data-slot="list-row-title"
          class="truncate text-body-dense font-semibold text-on-surface"
          >{{ label() }}</span
        >
      }
      @if (meta()) {
        <span class="truncate text-label-micro tracking-normal text-outline">{{
          meta()
        }}</span>
      }
    </span>
    <span class="flex shrink-0 items-center gap-2 empty:hidden"
      ><ng-content
    /></span>
    @if (chevron()) {
      <ng-icon
        name="matChevronRightOutline"
        class="icon-xs shrink-0 text-outline"
        aria-hidden="true"
      />
    }
  `,
})
export class DccmListRow {
  /** Le titre de la ligne. */
  readonly label = input.required<string>();
  /** La ligne de méta, sous le titre. */
  readonly meta = input<string>();
  /** Une case à cocher avant le titre (sur `<dccm-list-row>` seulement). */
  readonly checkable = input(false, { transform: booleanAttribute });
  /** La case est cochée : le titre est barré, en `outline`. */
  readonly checked = model(false);
  /** La ligne est sélectionnée : fond `primary-10`, bordure `primary-40`. */
  readonly selected = input(false, { transform: booleanAttribute });
  /** Un chevron en fin de ligne, quand elle mène à un détail. */
  readonly chevron = input(false, { transform: booleanAttribute });

  private readonly _id = prochainId++;
  protected readonly _idCase = `dccm-list-row-case-${this._id}`;
  protected readonly _idTitre = `dccm-list-row-titre-${this._id}`;

  private readonly _hoteInteractif = ['A', 'BUTTON'].includes(
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.tagName,
  );

  protected _avecCase(): boolean {
    return this.checkable() && !this._hoteInteractif;
  }

  protected _coche(): boolean {
    return this._avecCase() && this.checked();
  }
}
