import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  model,
  numberAttribute,
  signal,
} from '@angular/core';
import { type ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matAddOutline,
  matRemoveOutline,
} from '@ng-icons/material-symbols/outline';
import { HlmButton } from '@personal-os/ui/button';

/**
 * Le master `Stepper` : deux boutons d'icône remplis autour d'une case de
 * valeur. `sm` (28) est le master, `md` (36) sa variante mobile. La case est
 * un `spinbutton` : les flèches, Début et Fin la pilotent au clavier ; les
 * boutons sont des `Button/Icon` remplis (`variant="secondary"`).
 *
 * Compatible avec les formulaires réactifs ; sans formulaire, `value` est un
 * `model`.
 */
@Component({
  selector: 'dccm-stepper',
  imports: [HlmButton, NgIcon],
  providers: [
    provideIcons({ matAddOutline, matRemoveOutline }),
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DccmStepper),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'inline-flex items-center gap-1 data-[size=sm]:[&_[data-slot=button]]:size-7 [&_[data-slot=button]_ng-icon]:icon-xs',
    '[attr.data-size]': 'size()',
    '[attr.aria-label]': 'null',
    '(focusout)': 'toucher()',
  },
  template: `
    <button
      hlmBtn
      type="button"
      variant="secondary"
      size="icon"
      aria-label="Diminuer"
      [disabled]="desactive() || valeur() <= min()"
      (click)="poser(valeur() - step())"
    >
      <ng-icon name="matRemoveOutline" />
    </button>
    <span
      role="spinbutton"
      class="bg-surface-container-lowest text-body-dense text-on-surface focus-visible:outline-primary focus-visible:ring-primary-20 flex min-w-10 items-center justify-center rounded px-2 font-semibold tabular-nums outline-none focus-visible:outline-1 focus-visible:outline-solid focus-visible:-outline-offset-1 focus-visible:ring-2 aria-disabled:opacity-40"
      [class.h-7]="size() === 'sm'"
      [class.h-9]="size() === 'md'"
      [attr.tabindex]="desactive() ? -1 : 0"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-valuenow]="valeur()"
      [attr.aria-valuemin]="min()"
      [attr.aria-valuemax]="borneHaute()"
      [attr.aria-valuetext]="texte()"
      [attr.aria-disabled]="desactive() || null"
      (keydown)="clavier($event)"
      >{{ texte() }}</span
    >
    <button
      hlmBtn
      type="button"
      variant="secondary"
      size="icon"
      aria-label="Augmenter"
      [disabled]="desactive() || valeur() >= max()"
      (click)="poser(valeur() + step())"
    >
      <ng-icon name="matAddOutline" />
    </button>
  `,
})
export class DccmStepper implements ControlValueAccessor {
  readonly value = model<number | null>(null);

  /** L'unité affichée après la valeur (`850 g`). */
  readonly unit = input<string | null>(null);

  readonly min = input(0, { transform: numberAttribute });

  readonly max = input(Number.POSITIVE_INFINITY, {
    transform: numberAttribute,
  });

  readonly step = input(1, { transform: numberAttribute });

  /** `sm` : 28 px, le master ; `md` : 36 px, la cible tactile mobile. */
  readonly size = input<'sm' | 'md'>('sm');

  readonly disabled = input(false);

  /** Le nom de la valeur, lu par les lecteurs d'écran. */
  readonly ariaLabel = input<string | null>(null, { alias: 'aria-label' });

  private readonly desactiveParFormulaire = signal(false);

  protected readonly desactive = computed(
    () => this.disabled() || this.desactiveParFormulaire(),
  );

  protected readonly valeur = computed(() => this.value() ?? this.min());

  protected readonly texte = computed(() =>
    [this.valeur(), this.unit()].filter((part) => part !== null).join(' '),
  );

  protected readonly borneHaute = computed(() =>
    Number.isFinite(this.max()) ? this.max() : null,
  );

  private auChangement: (valeur: number) => void = () => undefined;
  private auToucher: () => void = () => undefined;

  protected poser(valeur: number): void {
    if (this.desactive()) return;
    const bornee = Math.min(this.max(), Math.max(this.min(), valeur));
    if (bornee === this.value()) return;
    this.value.set(bornee);
    this.auChangement(bornee);
  }

  protected clavier(event: KeyboardEvent): void {
    const cibles: Record<string, number> = {
      ArrowUp: this.valeur() + this.step(),
      ArrowRight: this.valeur() + this.step(),
      ArrowDown: this.valeur() - this.step(),
      ArrowLeft: this.valeur() - this.step(),
      Home: this.min(),
      End: this.max(),
    };
    const cible = cibles[event.key];
    if (cible === undefined || !Number.isFinite(cible)) return;
    event.preventDefault();
    this.poser(cible);
  }

  protected toucher(): void {
    this.auToucher();
  }

  writeValue(valeur: number | null): void {
    this.value.set(valeur);
  }

  registerOnChange(fn: (valeur: number) => void): void {
    this.auChangement = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.auToucher = fn;
  }

  setDisabledState(desactive: boolean): void {
    this.desactiveParFormulaire.set(desactive);
  }
}
