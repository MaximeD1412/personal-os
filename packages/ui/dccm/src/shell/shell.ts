import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Les masters `AppShell/Desktop`, `/Tablet` et `/Mobile`, en un seul
 * composant qui range ce qu'on lui projette selon la largeur :
 *
 * - à partir de 1280 px, la `dccm-top-bar` et la `dccm-sidebar` ;
 * - de 768 à 1279 px, la `dccm-top-bar` et la `dccm-sidebar variant="rail"` ;
 * - sous 768 px, le `dccm-mobile-header` et la `dccm-tab-bar`.
 *
 * Le reste est le contenu, avec une marge de 24 (16 sur mobile). Ce qui ne
 * sert pas à une largeur y est masqué (`display: none`), donc absent de
 * l'arbre d'accessibilité. La variante de la Sidebar se lit sur son attribut
 * `variant`, écrit en dur.
 */
@Component({
  selector: 'dccm-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-slot': 'shell',
    class: 'flex min-h-dvh flex-col bg-surface',
  },
  template: `
    <div class="sticky top-0 z-30 hidden md:block">
      <ng-content select="dccm-top-bar" />
    </div>
    <div class="sticky top-0 z-30 md:hidden">
      <ng-content select="dccm-mobile-header" />
    </div>

    <div class="flex flex-1">
      <div class="sticky top-16 hidden h-[calc(100dvh-4rem)] shrink-0 xl:flex">
        <ng-content select="dccm-sidebar:not([variant=rail])" />
      </div>
      <div
        class="sticky top-16 hidden h-[calc(100dvh-4rem)] shrink-0 md:flex xl:hidden"
      >
        <ng-content select="dccm-sidebar[variant=rail]" />
      </div>

      <main
        class="min-w-0 flex-1 p-margin-mobile pb-[calc(4rem+var(--margin-mobile)+env(safe-area-inset-bottom))] md:p-margin"
      >
        <ng-content />
      </main>
    </div>

    <div class="fixed inset-x-0 bottom-0 z-30 md:hidden">
      <ng-content select="dccm-tab-bar" />
    </div>
  `,
})
export class DccmShell {}
