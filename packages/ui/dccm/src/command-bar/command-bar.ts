import { Overlay } from '@angular/cdk/overlay';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matArrowForwardOutline,
  matHelpOutline,
  matProgressActivityOutline,
  matTerminalOutline,
} from '@ng-icons/material-symbols/outline';
import { HlmAlert, HlmAlertContent, HlmAlertDescription, HlmAlertIcon } from '@personal-os/ui/alert';
import { HlmButton } from '@personal-os/ui/button';
import {
  HlmDialog,
  HlmDialogContent,
  HlmDialogPortal,
  HlmDialogTitle,
} from '@personal-os/ui/dialog';
import { HlmInput, HlmInputGroup } from '@personal-os/ui/input';
import { HlmKbd } from '@personal-os/ui/kbd';
import { classes } from '@personal-os/ui/utils';

/**
 * Ce que la barre dit quand aucune action ne correspond (ADR 0018) : elle le
 * dit franchement, et propose l'écran le plus proche s'il y en a un.
 */
export interface DccmCommandFailure {
  /** L'écran le plus proche, une URL du tableau de bord. */
  nearestUrl?: string;
}

/** Le raccourci de la barre, tel que la plateforme l'écrit. */
function raccourci(): string {
  const plateforme =
    typeof navigator === 'undefined' ? '' : (navigator.platform ?? '');
  return /mac|iphone|ipad/i.test(plateforme) ? '⌘K' : 'Ctrl K';
}

/**
 * Le déclencheur de la barre de commande, sur un `<button>` : le champ
 * « Que veux-tu faire ? » de la `TopBar` et son raccourci, ou, `compact`, le
 * bouton de commande du `MobileHeader` (le libellé y devient son nom
 * accessible). Il n'ouvre rien de lui-même : son `(click)` appelle `open()`
 * de la barre.
 */
@Component({
  // Un composant posé sur `<button>` : le focus, Entrée et Espace restent
  // ceux du navigateur.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'button[dccmCommandBarTrigger]',
  imports: [NgIcon, HlmKbd],
  viewProviders: [provideIcons({ matTerminalOutline })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-slot': 'command-bar-trigger',
    type: 'button',
    'aria-haspopup': 'dialog',
    '[attr.aria-label]': 'compact() ? label() : null',
    '[attr.aria-keyshortcuts]': '"Control+K Meta+K"',
  },
  template: `
    <ng-icon name="matTerminalOutline" aria-hidden="true" />
    @if (!compact()) {
      <span class="flex-1 truncate text-start">{{ label() }}</span>
    }
    <kbd hlmKbd aria-hidden="true">{{ _raccourci }}</kbd>
  `,
})
export class DccmCommandBarTrigger {
  /** Le libellé, « Que veux-tu faire ? ». */
  readonly label = input.required<string>();
  /** Le bouton du `MobileHeader` : l'icône et le raccourci, sans le libellé. */
  readonly compact = input(false, { transform: booleanAttribute });

  protected readonly _raccourci = raccourci();

  constructor() {
    classes(() => [
      'flex cursor-pointer items-center gap-space-sm text-on-surface-variant outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary active:scale-98 [&>ng-icon]:icon-xs [&>ng-icon]:shrink-0 [&>ng-icon]:text-outline',
      this.compact()
        ? 'h-9 rounded bg-surface-container-high px-space-sm hover:bg-surface-container-highest'
        : 'h-8 w-full max-w-144 rounded border border-surface-container-high bg-surface-container-low px-space-md text-body-dense hover:border-outline-variant',
    ]);
  }
}

/**
 * La barre de commande (ADR 0018) : une palette en dialogue où l'utilisateur
 * écrit son intention. Elle ne résout rien elle-même : l'envoi émet
 * `submitted` avec la phrase telle quelle, et l'écran dit en retour ce qui se
 * passe (`pending`, `failure`, `error`). Elle n'affiche jamais de réponse en
 * phrase ni de chiffre : une action ouvre un formulaire, que l'écran navigue.
 *
 * Elle s'ouvre par `open()` (le déclencheur) ou par Ctrl+K / Cmd+K, depuis
 * n'importe quelle page. Sous 768 px, elle occupe tout l'écran.
 */
@Component({
  selector: 'dccm-command-bar',
  imports: [
    RouterLink,
    NgIcon,
    HlmAlert,
    HlmAlertContent,
    HlmAlertDescription,
    HlmAlertIcon,
    HlmButton,
    HlmDialog,
    HlmDialogContent,
    HlmDialogPortal,
    HlmDialogTitle,
    HlmInput,
    HlmInputGroup,
    HlmKbd,
  ],
  viewProviders: [
    provideIcons({
      matArrowForwardOutline,
      matHelpOutline,
      matProgressActivityOutline,
      matTerminalOutline,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-slot': 'command-bar',
    class: 'contents',
    '(document:keydown)': '_raccourci($event)',
  },
  template: `
    <hlm-dialog
      [positionStrategy]="_position"
      autoFocus="input"
      (closed)="_fermee()"
    >
      <hlm-dialog-content
        *hlmDialogPortal="let dialogue"
        data-slot="command-bar-palette"
        [showCloseButton]="false"
        class="max-w-175 bg-surface-container md:mt-14 max-md:h-dvh max-md:w-screen max-md:max-w-none max-md:rounded-none max-md:border-0"
      >
        <form
          class="flex flex-col gap-space-md p-space-lg max-md:p-gutter"
          (submit)="_envoyer($event)"
        >
          <div class="flex items-center justify-between gap-space-md">
            <h2 hlmDialogTitle class="text-label-micro uppercase text-primary">
              Barre de commande
            </h2>
            <button
              type="button"
              data-slot="command-bar-close"
              class="flex cursor-pointer items-center gap-space-sm rounded px-space-sm py-1 text-label-regular text-outline outline-none transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:ring-2 focus-visible:ring-primary"
              (click)="dialogue.close()"
            >
              Fermer
              <kbd hlmKbd aria-hidden="true" class="max-md:hidden">Échap</kbd>
            </button>
          </div>

          <div hlmInputGroup size="lg">
            <ng-icon name="matTerminalOutline" />
            <input
              hlmInput
              name="commande"
              autocomplete="off"
              aria-label="Que veux-tu faire ?"
              placeholder="Que veux-tu faire ?"
              maxlength="500"
              enterkeyhint="go"
              [value]="_texte()"
              (input)="_texte.set($any($event.target).value)"
            />
          </div>

          <div role="status" aria-live="polite" class="flex flex-col gap-space-md empty:hidden">
            @if (pending()) {
              <p
                data-slot="command-bar-pending"
                class="flex items-center gap-space-sm text-body-dense text-on-surface-variant"
              >
                <ng-icon
                  name="matProgressActivityOutline"
                  class="icon-sm animate-spin text-primary"
                  aria-hidden="true"
                />
                Je cherche…
              </p>
            } @else if (error(); as message) {
              <div hlmAlert tone="error" data-slot="command-bar-error">
                <hlm-alert-icon />
                <div hlmAlertContent>
                  <p hlmAlertDescription>{{ message }}</p>
                </div>
              </div>
            } @else if (failure(); as echec) {
              <div
                data-slot="command-bar-failure"
                class="flex flex-wrap items-center gap-space-md rounded border border-surface-container-highest bg-surface-container-high p-space-md"
              >
                <span
                  class="flex size-8 shrink-0 items-center justify-center rounded bg-surface-container-highest text-outline"
                >
                  <ng-icon name="matHelpOutline" class="icon-sm" aria-hidden="true" />
                </span>
                <p class="min-w-0 grow basis-48 text-body-default text-on-surface">
                  Je ne sais pas encore faire ça.
                </p>
                @if (echec.nearestUrl; as url) {
                  <a
                    hlmBtn
                    variant="secondary"
                    size="sm"
                    data-slot="command-bar-nearest"
                    [routerLink]="url"
                    (click)="dialogue.close()"
                  >
                    Ouvrir l'écran le plus proche
                    <ng-icon name="matArrowForwardOutline" aria-hidden="true" />
                  </a>
                }
              </div>
            }
          </div>
        </form>
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class DccmCommandBar {
  /** Une résolution est en cours : la barre dit « Je cherche… ». */
  readonly pending = input(false, { transform: booleanAttribute });
  /** Aucune action ne correspond à la dernière phrase envoyée. */
  readonly failure = input<DccmCommandFailure | null>(null);
  /** Le `message` d'une erreur de l'API, affiché tel quel. */
  readonly error = input<string | null>(null);

  /** La phrase envoyée, telle que l'utilisateur l'a écrite. */
  readonly submitted = output<string>();
  /** La barre s'est fermée (Échap, « Fermer », clic dehors, `close()`). */
  readonly closed = output<void>();

  private readonly _dialogue = viewChild.required(HlmDialog);
  protected readonly _texte = signal('');

  // Ancrée en haut : à 56 px du bord sur desktop (`md:mt-14`), plein écran
  // sous 768 px.
  protected readonly _position = inject(Overlay)
    .position()
    .global()
    .centerHorizontally()
    .top('0');

  /** Ouvre la barre, le champ prêt à la saisie. */
  open(): void {
    if (this._dialogue().stateComputed() !== 'open') {
      this._dialogue().open();
    }
  }

  /** Ferme la barre (une action a été choisie, l'écran navigue). */
  close(): void {
    this._dialogue().close();
  }

  protected _raccourci(event: KeyboardEvent): void {
    if (
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      !event.shiftKey &&
      event.key.toLowerCase() === 'k'
    ) {
      event.preventDefault();
      this.open();
    }
  }

  protected _envoyer(event: Event): void {
    event.preventDefault();
    const texte = this._texte();
    if (this.pending() || !/\S/.test(texte)) {
      return;
    }
    this.submitted.emit(texte);
  }

  protected _fermee(): void {
    this._texte.set('');
    this.closed.emit();
  }
}
