import { FocusTrapFactory, type FocusTrap } from '@angular/cdk/a11y';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { matCloseOutline } from '@ng-icons/material-symbols/outline';
import { HlmAlertImports } from '@personal-os/ui/alert';
import { HlmButton } from '@personal-os/ui/button';
import { classes } from '@personal-os/ui/utils';
import { DccmPageHeader, type DccmCrumb } from '../page-header/page-header';

/**
 * Où le formulaire se pose : une page entière, un panneau à droite d'une liste
 * (le formulaire du Calendrier à 1424), une feuille qui monte du bas (le même
 * à 390). La route du formulaire reste la même quelle que soit la présentation.
 */
export type DccmFormPagePresentation = 'page' | 'panel' | 'sheet';

/** Ce que l'écran garde du refus de l'API (`ErreurApi`, `ApiError`). */
export interface DccmFormPageError {
  message: string;
  fields?: readonly unknown[];
}

const presentations: Record<DccmFormPagePresentation, string> = {
  page: 'flex flex-col gap-margin',
  panel:
    'flex flex-col gap-gutter rounded-md border border-surface-container-highest bg-surface-container p-gutter',
  sheet:
    'fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col gap-gutter overflow-y-auto rounded-t-lg border-t border-surface-container-highest bg-surface-container-low px-gutter pt-space-sm shadow-popover',
};

let prochainId = 0;

/**
 * Le motif « formulaire prérempli » (ADR 0030) : un en-tête (`DccmPageHeader`
 * en page ; titre et bouton de fermeture en panneau et en feuille), le bandeau
 * des valeurs du lien non reprises (`ignored`, tiré de
 * `prefillDepuisRequete`), le bandeau d'un refus de l'API qui ne vise aucun
 * champ, les champs projetés, puis « Annuler » et l'action principale, en
 * `loading` pendant l'envoi (`pending`).
 *
 * Il n'enregistre rien de lui-même : il émet `submitted`, l'écran envoie. Les
 * erreurs de champ s'affichent dans les `hlmField` projetés, depuis
 * `erreursDeChamp` (docs/design-system.md, « Composer un écran »).
 *
 * En feuille, il est modal, comme un dialogue : il prend le focus à son
 * ouverture, le garde à la tabulation, se ferme par Échap (`cancelled`) et
 * rend le focus à ce qui l'avait à sa fermeture. L'écran pose le voile qui
 * bloque le pointeur derrière lui.
 */
@Component({
  selector: 'dccm-form-page',
  imports: [DccmPageHeader, HlmAlertImports, HlmButton, NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-slot': 'form-page',
    '[attr.data-presentation]': 'presentation()',
    '[attr.role]': '_role()',
    '[attr.aria-modal]': "presentation() === 'sheet' ? 'true' : null",
    '[attr.aria-labelledby]': "presentation() === 'page' ? null : _idTitre",
    '(keydown.escape)': '_echap($event)',
  },
  template: `
    @if (presentation() === 'page') {
      <dccm-page-header
        [heading]="heading()"
        [subtitle]="subtitle()"
        [breadcrumb]="breadcrumb()"
      />
    } @else {
      @if (presentation() === 'sheet') {
        <span
          class="mx-auto h-1 w-10 shrink-0 rounded-full bg-outline-variant"
          aria-hidden="true"
        ></span>
      }
      <div class="flex items-start justify-between gap-space-sm">
        <div class="flex min-w-0 flex-col gap-0.5">
          <h2 class="text-headline-md text-on-surface" [id]="_idTitre">
            {{ heading() }}
          </h2>
          @if (subtitle()) {
            <p class="text-body-dense text-outline">{{ subtitle() }}</p>
          }
        </div>
        <button
          hlmBtn
          variant="ghost"
          size="icon"
          type="button"
          aria-label="Fermer"
          (click)="cancelled.emit()"
        >
          <ng-icon [svg]="_iconeFermer" aria-hidden="true" />
        </button>
      </div>
    }

    <form
      novalidate
      [class]="_classesFormulaire()"
      [attr.aria-busy]="pending() || null"
      (submit)="$event.preventDefault(); _envoyer()"
    >
      @if (ignored().length > 0) {
        <div hlmAlert tone="warning" data-test="ignores">
          <hlm-alert-icon />
          <div hlmAlertContent>
            <p hlmAlertTitle>
              Certaines valeurs du lien n'ont pas été reprises :
              {{ ignored().join(', ') }}
            </p>
            <p hlmAlertDescription>
              Elles ne correspondent à aucune valeur admise : le formulaire
              garde les siennes.
            </p>
          </div>
        </div>
      }
      @if (_refusSansChamp(); as message) {
        <div hlmAlert tone="error" data-test="refus">
          <hlm-alert-icon />
          <div hlmAlertContent>
            <p hlmAlertTitle>{{ message }}</p>
          </div>
        </div>
      }

      <div class="flex flex-col gap-gutter"><ng-content /></div>

      <div [class]="_classesActions()">
        <ng-content select="[dccmFormPageStatus]" />
        <button hlmBtn variant="secondary" type="button" (click)="cancelled.emit()">
          {{ cancelLabel() }}
        </button>
        <button
          hlmBtn
          type="submit"
          [loading]="pending()"
          [disabled]="submitDisabled()"
        >
          {{ submitLabel() }}
        </button>
      </div>
    </form>
  `,
})
export class DccmFormPage {
  public readonly heading = input.required<string>();
  public readonly subtitle = input<string>();
  /** Le fil d'Ariane, en présentation `page`. */
  public readonly breadcrumb = input<readonly DccmCrumb[]>([]);
  public readonly presentation = input<DccmFormPagePresentation>('page');
  /** Les paramètres du lien écartés (`nom=valeur`), de `prefillDepuisRequete`. */
  public readonly ignored = input<readonly string[]>([]);
  /** Le dernier refus de l'API ; sans `fields`, il s'affiche en bandeau. */
  public readonly error = input<DccmFormPageError | null | undefined>();
  /** L'envoi en cours : l'action principale passe en `loading`. */
  public readonly pending = input(false, { transform: booleanAttribute });
  public readonly submitDisabled = input(false, { transform: booleanAttribute });
  /** L'action principale, nommée par ce qu'elle fait : « Créer l'événement ». */
  public readonly submitLabel = input.required<string>();
  public readonly cancelLabel = input('Annuler');

  /** L'utilisateur envoie le formulaire ; jamais pendant un envoi. */
  public readonly submitted = output<void>();
  /** « Annuler », ou la fermeture du panneau. */
  public readonly cancelled = output<void>();

  protected readonly _idTitre = `dccm-form-page-${prochainId++}`;
  protected readonly _iconeFermer = matCloseOutline;

  protected readonly _role = computed(() => {
    switch (this.presentation()) {
      case 'page':
        return null;
      case 'panel':
        return 'region';
      case 'sheet':
        return 'dialog';
    }
  });

  private readonly _hote = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _pieges = inject(FocusTrapFactory);
  private _piege: FocusTrap | null = null;
  /** Ce qui avait le focus quand la feuille s'est ouverte. */
  private _focusARendre: HTMLElement | null = null;

  protected readonly _refusSansChamp = computed(() => {
    const refus = this.error();
    return refus && !refus.fields?.length ? refus.message : null;
  });

  protected readonly _classesFormulaire = computed(() =>
    this.presentation() === 'page'
      ? 'flex flex-col gap-gutter rounded-md border border-surface-container-highest bg-surface-container p-gutter-compact md:p-gutter'
      : 'flex flex-col gap-gutter',
  );

  protected readonly _classesActions = computed(() =>
    [
      'flex flex-wrap items-center justify-end gap-space-sm',
      this.presentation() === 'sheet'
        ? 'sticky bottom-0 -mx-gutter border-t border-surface-container-highest bg-surface-container-low px-gutter py-space-md'
        : '',
    ].join(' '),
  );

  constructor() {
    classes(() => presentations[this.presentation()]);

    effect(() => {
      if (this.presentation() === 'sheet') {
        this._pieger();
      } else {
        this._liberer();
      }
    });

    inject(DestroyRef).onDestroy(() => {
      this._liberer();
      if (this._focusARendre?.isConnected) {
        this._focusARendre.focus();
      }
      this._focusARendre = null;
    });
  }

  /**
   * Échap ferme la feuille, sauf quand il revient d'abord à ce qu'elle
   * contient d'ouvert : la liste d'un `hlm-select` garde le focus sur son
   * déclencheur (`aria-expanded="true"`) et se ferme par la surcouche du CDK,
   * à l'écoute sur le `body`, donc après la feuille.
   */
  protected _echap(evenement: Event): void {
    if (this.presentation() !== 'sheet' || evenement.defaultPrevented) return;
    const cible = evenement.target;
    if (cible instanceof Element && cible.closest('[aria-expanded="true"]')) {
      return;
    }
    this.cancelled.emit();
  }

  private _pieger(): void {
    if (this._piege) return;
    const actif = this._hote.nativeElement.ownerDocument.activeElement;
    this._focusARendre = actif instanceof HTMLElement ? actif : null;
    this._piege = this._pieges.create(this._hote.nativeElement, true);
    this._piege.attachAnchors();
    void this._piege.focusInitialElementWhenReady();
  }

  private _liberer(): void {
    this._piege?.destroy();
    this._piege = null;
  }

  protected _envoyer(): void {
    if (this.pending() || this.submitDisabled()) return;
    this.submitted.emit();
  }
}
