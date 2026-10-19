import {
  ChangeDetectionStrategy,
  Component,
  input,
  numberAttribute,
  output,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { matRefreshOutline } from '@ng-icons/material-symbols/outline';
import { HlmButton } from '@personal-os/ui/button';
import { HlmSkeleton } from '@personal-os/ui/skeleton';
import { DccmEmptyState } from '../empty-state/empty-state';

export type DccmStateStatus = 'loading' | 'empty' | 'error' | 'ready';

/** La forme du squelette : celle du contenu attendu. */
export type DccmStateSkeleton = 'list' | 'cards' | 'detail';

/** Ce qu'une lecture (`httpResource`, `resource`) expose de son état. */
export interface DccmStateSource<T> {
  isLoading(): boolean;
  error(): unknown;
  hasValue(): boolean;
  value(): T | undefined;
}

/**
 * L'état d'une lecture : `loading` tant qu'aucune valeur n'est là (un
 * rechargement garde la valeur affichée), `error`, puis `empty` ou `ready`.
 */
export function stateOf<T>(
  source: DccmStateSource<T>,
  isEmpty: (value: T) => boolean,
): DccmStateStatus {
  if (source.hasValue()) {
    return isEmpty(source.value() as T) ? 'empty' : 'ready';
  }
  if (source.error()) return 'error';
  return 'loading';
}

/**
 * Les trois états d'un écran qui lit des données, autour de son contenu :
 *
 * - `loading` : un squelette à la forme du contenu attendu (`skeleton`), dans
 *   une zone `aria-busy` ;
 * - `empty` : `DccmEmptyState`, et l'action projetée en `[dccmStateEmpty]` ;
 * - `error` : le `message` de l'API tel quel, et « Réessayer » (`retry`) ;
 * - `ready` : le contenu projeté.
 */
@Component({
  selector: 'dccm-state',
  imports: [DccmEmptyState, HlmSkeleton, HlmButton, NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-slot': 'state', '[attr.data-status]': 'status()' },
  template: `
    @switch (status()) {
      @case ('loading') {
        <div aria-busy="true" [attr.aria-label]="loadingLabel()" role="status">
          @switch (skeleton()) {
            @case ('cards') {
              <div class="grid gap-gutter sm:grid-cols-2 xl:grid-cols-3">
                @for (ligne of _lignes(); track $index) {
                  <div
                    class="flex flex-col gap-2.5 rounded-md border border-surface-container-highest bg-surface-container p-gutter"
                  >
                    <hlm-skeleton class="h-3.5 w-3/4" />
                    <hlm-skeleton class="h-2.5 w-full" />
                    <hlm-skeleton class="h-2.5 w-2/3" />
                  </div>
                }
              </div>
            }
            @case ('detail') {
              <div
                class="flex flex-col gap-gutter rounded-md border border-surface-container-highest bg-surface-container p-gutter"
              >
                <hlm-skeleton class="h-5 w-1/2" />
                @for (ligne of _lignes(); track $index) {
                  <div class="flex flex-col gap-2.5">
                    <hlm-skeleton class="h-2.5 w-full" />
                    <hlm-skeleton class="h-2.5 w-5/6" />
                  </div>
                }
              </div>
            }
            @default {
              <div
                class="flex flex-col gap-space-md rounded-md border border-surface-container-highest bg-surface-container p-gutter"
              >
                <div class="flex items-center justify-between gap-gutter">
                  <hlm-skeleton class="h-3.5 w-1/3" />
                  <hlm-skeleton class="h-3.5 w-16" />
                </div>
                @for (ligne of _lignes(); track $index) {
                  <div
                    class="flex items-center gap-space-md rounded bg-surface-container-low p-space-md"
                  >
                    <hlm-skeleton class="size-8 shrink-0 rounded-full" />
                    <div class="flex flex-1 flex-col gap-2">
                      <hlm-skeleton class="h-3 w-1/2" />
                      <hlm-skeleton class="h-2.5 w-1/3" />
                    </div>
                    <hlm-skeleton class="h-3 w-10" />
                  </div>
                }
              </div>
            }
          }
        </div>
      }
      @case ('empty') {
        <dccm-empty-state
          [heading]="emptyHeading()"
          [description]="emptyDescription()"
          [icon]="emptyIcon()"
        >
          <ng-content select="[dccmStateEmpty]" />
        </dccm-empty-state>
      }
      @case ('error') {
        <dccm-empty-state
          role="alert"
          variant="error"
          [heading]="errorHeading()"
          [description]="error()?.message"
        >
          <button hlmBtn variant="secondary" type="button" (click)="retry.emit()">
            <ng-icon [svg]="_iconeReessayer" aria-hidden="true" />
            Réessayer
          </button>
        </dccm-empty-state>
      }
      @default {
        <ng-content />
      }
    }
  `,
})
export class DccmState {
  public readonly status = input.required<DccmStateStatus>();
  /** L'erreur de la lecture : son `message` (celui de l'API) s'affiche tel quel. */
  public readonly error = input<{ message: string } | null | undefined>();
  public readonly skeleton = input<DccmStateSkeleton>('list');
  /** Le nombre de lignes, de cartes ou de paragraphes du squelette. */
  public readonly rows = input(3, { transform: numberAttribute });
  public readonly loadingLabel = input('Chargement…');
  public readonly emptyHeading = input('Rien à afficher');
  public readonly emptyDescription = input<string>();
  /** Le SVG de l'icône de l'état vide. */
  public readonly emptyIcon = input<string>();
  public readonly errorHeading = input('Le chargement a échoué');
  /** « Réessayer » : relancer la lecture (`resource.reload()`). */
  public readonly retry = output<void>();

  protected readonly _iconeReessayer = matRefreshOutline;
  protected _lignes(): number[] {
    return Array.from({ length: this.rows() }, (_, i) => i);
  }
}
