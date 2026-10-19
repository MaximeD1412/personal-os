import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import {
  HlmAlertDialogDescription,
  HlmAlertDialogFooter,
  HlmAlertDialogHeader,
  HlmAlertDialogTitle,
} from '@personal-os/ui/alert-dialog';
import { HlmButton } from '@personal-os/ui/button';
import {
  HlmDialogBody,
  hlmModalContentClass,
  hlmModalOverlayClass,
} from '@personal-os/ui/dialog';
import { classes } from '@personal-os/ui/utils';
import {
  BrnDialogRef,
  BrnDialogService,
  injectBrnDialogContext,
} from '@spartan-ng/brain/dialog';
import { firstValueFrom, map } from 'rxjs';

/** Une confirmation simple : la question, et le verbe qui la tranche. */
export interface DccmConfirmOptions {
  /** La question, terminée par « ? » : « Clôturer la liste de courses ? ». */
  title: string;
  /** Ce que l'action entraîne. */
  description?: string;
  /** L'action principale, nommée par le verbe : « Clôturer la liste ». */
  confirmLabel: string;
  cancelLabel?: string;
  /** Une suppression : l'action principale passe en `destructive`. */
  destructive?: boolean;
}

/** La portée d'une action sur une occurrence d'une série (AGENDA-2). */
export type DccmScope = 'occurrence' | 'series';

export interface DccmScopeOptions {
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Ce que change « Cette occurrence uniquement ». */
  occurrenceDescription?: string;
  /** Ce que change « Toute la série ». */
  seriesDescription?: string;
}

interface DccmScopeOption {
  value: DccmScope;
  label: string;
  description: string;
}

type Contexte = DccmConfirmOptions & { scopes?: DccmScopeOption[] };

/** Le dialogue que `DccmConfirm` ouvre : une modale, rôle `alertdialog`. */
@Component({
  selector: 'dccm-confirm-dialog',
  imports: [
    HlmAlertDialogHeader,
    HlmAlertDialogTitle,
    HlmAlertDialogDescription,
    HlmAlertDialogFooter,
    HlmDialogBody,
    HlmButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-slot': 'confirm',
    '[attr.data-state]': '_ref.state()',
  },
  template: `
    <hlm-alert-dialog-header>
      <h2 hlmAlertDialogTitle>{{ _options.title }}</h2>
      @if (_options.description) {
        <p hlmAlertDialogDescription>{{ _options.description }}</p>
      }
    </hlm-alert-dialog-header>
    @if (_options.scopes; as scopes) {
      <div hlmDialogBody role="radiogroup" aria-label="Portée de l'action">
        @for (option of scopes; track option.value) {
          <label
            class="flex cursor-pointer items-start gap-space-sm rounded border border-surface-container-highest p-space-md has-checked:border-primary-40 has-checked:bg-primary-10 has-focus-visible:border-primary has-focus-visible:ring-2 has-focus-visible:ring-primary-20"
          >
            <input
              type="radio"
              name="dccm-confirm-portee"
              class="mt-0.5 size-4 shrink-0 accent-primary outline-none"
              [value]="option.value"
              (change)="_portee.set(option.value)"
            />
            <span class="flex flex-col gap-0.5">
              <span class="text-title-sm text-on-surface">{{ option.label }}</span>
              <span class="text-body-dense text-on-surface-variant">{{
                option.description
              }}</span>
            </span>
          </label>
        }
      </div>
    }
    <hlm-alert-dialog-footer>
      <button hlmBtn variant="secondary" type="button" (click)="_ref.close()">
        {{ _options.cancelLabel ?? 'Annuler' }}
      </button>
      <button
        hlmBtn
        type="button"
        [variant]="_options.destructive ? 'destructive' : 'primary'"
        [disabled]="!_pret()"
        (click)="_confirmer()"
      >
        {{ _options.confirmLabel }}
      </button>
    </hlm-alert-dialog-footer>
  `,
})
export class DccmConfirmDialog {
  protected readonly _ref = inject<BrnDialogRef<true | DccmScope>>(BrnDialogRef);
  protected readonly _options = injectBrnDialogContext<Contexte>();
  /** Le choix de portée : aucun par défaut, l'utilisateur choisit toujours. */
  protected readonly _portee = signal<DccmScope | null>(null);
  protected readonly _pret = computed(
    () => !this._options.scopes || this._portee() !== null,
  );

  constructor() {
    classes(() => hlmModalContentClass);
  }

  protected _confirmer(): void {
    const portee = this._portee();
    if (this._options.scopes) {
      if (portee) this._ref.close(portee);
    } else {
      this._ref.close(true);
    }
  }
}

/**
 * Pose une question avant une transition métier (clôturer, arrêter, déclarer,
 * publier, fusionner, supprimer) et renvoie la réponse : le choix, ou `null`
 * si l'utilisateur annule (bouton, Échap). Le dialogue piège le focus et le
 * rend au déclencheur ; un clic hors de lui ne le ferme pas.
 *
 * Une création ou une modification simple ne passe pas par là.
 */
@Injectable({ providedIn: 'root' })
export class DccmConfirm {
  private readonly _dialogues = inject(BrnDialogService);

  /** Une confirmation simple : `true`, ou `null` à l'annulation. */
  confirm(options: DccmConfirmOptions): Promise<true | null> {
    return this._ouvrir<true>(options);
  }

  /**
   * Le choix « Cette occurrence uniquement » / « Toute la série », sans option
   * par défaut : l'action principale reste inactive tant qu'il n'est pas fait.
   */
  chooseScope(options: DccmScopeOptions): Promise<DccmScope | null> {
    const {
      occurrenceDescription = 'Seule cette occurrence change ; les autres restent intactes.',
      seriesDescription = 'Toutes les occurrences de la série changent.',
      ...question
    } = options;
    return this._ouvrir<DccmScope>({
      ...question,
      scopes: [
        {
          value: 'occurrence',
          label: 'Cette occurrence uniquement',
          description: occurrenceDescription,
        },
        { value: 'series', label: 'Toute la série', description: seriesDescription },
      ],
    });
  }

  private _ouvrir<T>(contexte: Contexte): Promise<T | null> {
    const ref = this._dialogues.open<Contexte, T>(
      DccmConfirmDialog,
      undefined,
      contexte,
      {
        role: 'alertdialog',
        closeOnOutsidePointerEvents: false,
        backdropClass: hlmModalOverlayClass.split(' '),
        autoFocus: 'first-tabbable',
        restoreFocus: true,
      },
    );
    return firstValueFrom(ref.closed$.pipe(map((choix) => choix ?? null)));
  }
}
