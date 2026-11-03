import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { HlmBreadcrumbImports } from '@personal-os/ui/breadcrumb';

/** Un niveau du fil d'Ariane ; le dernier est la page, sans lien. */
export interface DccmCrumb {
  label: string;
  link?: string;
}

/**
 * Le master `PageHeader` : le fil d'Ariane, le titre en `headline-lg` (22 px
 * sous 768), le sous-titre en `outline`, et les actions de la page projetées
 * à droite (un bouton secondaire, un primaire).
 */
@Component({
  selector: 'dccm-page-header',
  imports: [HlmBreadcrumbImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-slot': 'page-header',
    class: 'flex flex-col gap-1.5',
  },
  template: `
    @if (breadcrumb().length) {
      <nav hlmBreadcrumb>
        <ol hlmBreadcrumbList>
          @for (niveau of breadcrumb(); track $index; let dernier = $last) {
            <li hlmBreadcrumbItem>
              @if (dernier) {
                <span hlmBreadcrumbPage>{{ niveau.label }}</span>
              } @else if (niveau.link) {
                <a hlmBreadcrumbLink [link]="niveau.link">{{ niveau.label }}</a>
              } @else {
                <span>{{ niveau.label }}</span>
              }
            </li>
            @if (!dernier) {
              <li hlmBreadcrumbSeparator></li>
            }
          }
        </ol>
      </nav>
    }
    <div class="flex flex-wrap items-end justify-between gap-gutter">
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <h1 class="text-headline-lg-mobile text-on-surface md:text-headline-lg">
          {{ heading() }}
        </h1>
        @if (subtitle()) {
          <p class="text-body-default text-outline">{{ subtitle() }}</p>
        }
      </div>
      <div class="flex items-center gap-space-sm empty:hidden"><ng-content /></div>
    </div>
  `,
})
export class DccmPageHeader {
  /** Le titre de la page. */
  readonly heading = input.required<string>();
  /** La ligne sous le titre. */
  readonly subtitle = input<string>();
  /** Le fil d'Ariane, du plus large au plus précis. */
  readonly breadcrumb = input<readonly DccmCrumb[]>([]);
}
