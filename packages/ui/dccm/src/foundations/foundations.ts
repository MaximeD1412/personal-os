import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matCalendarMonthOutline } from '@ng-icons/material-symbols/outline';

// Les planches des stories Foundations, à l'image de la planche
// `Design System / 00 Foundations` de la bibliothèque pen.dev. Les noms des
// jetons sont écrits ici ; leurs valeurs sont lues dans la feuille chargée,
// si bien qu'une story montre toujours ce que `tokens.css` sert vraiment.

/** La valeur calculée d'un jeton sur la racine du document. */
function lecteurDeJetons() {
  const racine = inject(DOCUMENT).documentElement;
  return (nom: string) => getComputedStyle(racine).getPropertyValue(`--${nom}`).trim();
}

export const RAMPES_DE_COULEURS = [
  {
    titre: 'Surfaces',
    jetons: [
      'surface',
      'surface-dim',
      'surface-bright',
      'surface-container-lowest',
      'surface-container-low',
      'surface-container',
      'surface-container-high',
      'surface-container-highest',
    ],
  },
  {
    titre: 'Texte & bordures',
    jetons: ['on-surface', 'on-surface-variant', 'outline', 'outline-variant', 'inverse-surface', 'inverse-on-surface'],
  },
  {
    titre: 'Primary',
    jetons: [
      'primary',
      'on-primary',
      'primary-container',
      'on-primary-container',
      'primary-fixed',
      'primary-fixed-dim',
      'on-primary-fixed',
      'on-primary-fixed-variant',
      'inverse-primary',
    ],
  },
  {
    titre: 'Secondary (succès)',
    jetons: [
      'secondary',
      'on-secondary',
      'secondary-container',
      'on-secondary-container',
      'secondary-fixed',
      'secondary-fixed-dim',
      'on-secondary-fixed',
      'on-secondary-fixed-variant',
    ],
  },
  {
    titre: 'Tertiary (attente)',
    jetons: [
      'tertiary',
      'on-tertiary',
      'tertiary-container',
      'on-tertiary-container',
      'tertiary-fixed',
      'tertiary-fixed-dim',
      'on-tertiary-fixed',
      'on-tertiary-fixed-variant',
    ],
  },
  { titre: 'Error', jetons: ['error', 'on-error', 'error-container', 'on-error-container'] },
];

export const PISTES_TEINTEES = [
  { jeton: 'primary-20', usage: 'sélection, filtre actif, badge info' },
  { jeton: 'primary-10', usage: 'ligne sélectionnée' },
  { jeton: 'secondary-20', usage: 'badge succès (secondary-container)' },
  { jeton: 'secondary-15', usage: 'badge succès, pastille en ligne' },
  { jeton: 'tertiary-15', usage: 'badge attente' },
  { jeton: 'tertiary-20', usage: 'bannière avertissement (tertiary-container)' },
  { jeton: 'error-20', usage: 'badge alerte, bouton destructif' },
  { jeton: 'error-30', usage: 'bannière critique' },
];

// Les classes sont écrites en entier pour que Tailwind les trouve.
export const ECHELLE_TYPOGRAPHIQUE = [
  { jeton: 'display-hero', classe: 'text-display-hero', exemple: 'Architecte Systèmes Distribués' },
  { jeton: 'headline-lg', classe: 'text-headline-lg', exemple: 'Bonjour Maxime' },
  { jeton: 'headline-lg-mobile', classe: 'text-headline-lg-mobile', exemple: 'Planning de repas' },
  { jeton: 'headline-md', classe: 'text-headline-md', exemple: '1. Formulaires & Bannières' },
  { jeton: 'title-sm', classe: 'text-title-sm', exemple: 'Poulet basquaise traditionnel & riz' },
  { jeton: 'body-default', classe: 'text-body-default', exemple: 'Règles sanitaires et gestion des préférences du foyer.' },
  { jeton: 'body-dense', classe: 'text-body-dense', exemple: 'Cabinet Dr. Martin · Contrôle annuel' },
  { jeton: 'label-regular', classe: 'text-label-regular', exemple: 'Semaine du 26 mai au 1er juin' },
  { jeton: 'label-micro', classe: 'text-label-micro uppercase', exemple: 'Organisation · Agenda' },
  { jeton: 'telemetry-metric', classe: 'text-telemetry-metric tabular-nums', exemple: '12 articles restants' },
  { jeton: 'code-mono', classe: 'text-code-mono font-mono', exemple: 'sha256: 7f8c..9d12 · 1,842 tok' },
];

export const ESPACEMENTS = [
  'space-xs',
  'space-sm',
  'space-md',
  'gutter-compact',
  'gutter',
  'margin-mobile',
  'space-lg',
  'margin',
  'space-xl',
  'space-2xl',
];

export const RAYONS = [
  { jeton: 'radius-sm', usage: 'tags, raccourcis clavier' },
  { jeton: 'radius', usage: 'boutons, champs, navigation' },
  { jeton: 'radius-md', usage: 'cartes, modales' },
  { jeton: 'radius-lg', usage: '' },
  { jeton: 'radius-full', usage: 'pastilles, avatars, points' },
];

export const TAILLES_ICONE = [
  { jeton: 'icon-xs', classe: 'icon-xs', usage: 'badges, tags, fil d’Ariane, tableaux denses' },
  { jeton: 'icon-sm', classe: 'icon-sm', usage: 'navigation, listes, boutons' },
  { jeton: 'icon-md', classe: 'icon-md', usage: 'en-têtes de carte, tuiles KPI' },
  { jeton: 'icon-lg', classe: 'icon-lg', usage: 'barre d’onglets mobile, actions de page' },
  { jeton: 'icon-xl', classe: 'icon-xl', usage: 'états vides et d’erreur' },
];

export const ELEVATIONS = [
  { nom: 'Canvas → carte', classe: 'bg-surface-container border border-surface-container-highest' },
  { nom: 'Carte survolée', classe: 'bg-surface-container border border-outline-variant' },
  { nom: 'Imbriqué', classe: 'bg-surface-container-high' },
  { nom: 'Modale / popover', classe: 'bg-surface-container-high border border-outline-variant shadow-popover' },
];

/** Une section de planche : titre, description, contenu. */
@Component({
  selector: 'dccm-foundations-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-gutter p-space-2xl' },
  template: `
    <header class="flex flex-col gap-0.5">
      <h2 class="text-headline-md text-on-surface">{{ titre() }}</h2>
      <p class="text-body-dense text-outline">{{ description() }}</p>
    </header>
    <ng-content />
  `,
})
export class DccmFoundationsSection {
  readonly titre = input.required<string>();
  readonly description = input('');
}

@Component({
  selector: 'dccm-foundations-couleurs',
  imports: [DccmFoundationsSection],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dccm-foundations-section
      titre="Couleurs"
      description="Les 43 couleurs de la bibliothèque, sous leurs noms pen.dev. Les écrans n'utilisent que ces jetons et les pistes teintées."
    >
      @for (rampe of rampes; track rampe.titre) {
        <section class="flex flex-col gap-space-sm">
          <h3 class="text-label-micro uppercase text-outline">{{ rampe.titre }}</h3>
          <ul class="flex flex-wrap gap-space-md">
            @for (jeton of rampe.jetons; track jeton) {
              <li class="flex w-[136px] flex-col gap-1.5">
                <span
                  class="h-14 rounded border border-surface-container-highest"
                  [style.background]="'var(--' + jeton + ')'"
                ></span>
                <span class="text-label-micro font-semibold text-on-surface">{{ jeton }}</span>
                <code class="text-label-micro uppercase text-outline">{{ valeur(jeton) }}</code>
              </li>
            }
          </ul>
        </section>
      }
    </dccm-foundations-section>
  `,
})
export class DccmFoundationsCouleurs {
  protected readonly rampes = RAMPES_DE_COULEURS;
  protected readonly valeur = lecteurDeJetons();
}

@Component({
  selector: 'dccm-foundations-pistes',
  imports: [DccmFoundationsSection],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dccm-foundations-section
      titre="Pistes teintées"
      description="Les seules valeurs alpha permises : des couleurs de la bibliothèque à 10, 15, 20 ou 30 %."
    >
      <ul class="flex flex-wrap gap-space-md">
        @for (piste of pistes; track piste.jeton) {
          <li class="flex w-40 flex-col gap-1.5">
            <span class="h-11 rounded" [style.background]="'var(--' + piste.jeton + ')'"></span>
            <span class="text-label-micro font-semibold text-on-surface">{{ piste.jeton }}</span>
            <span class="text-label-micro text-outline">
              <code class="uppercase">{{ valeur(piste.jeton) }}</code> · {{ piste.usage }}
            </span>
          </li>
        }
      </ul>
    </dccm-foundations-section>
  `,
})
export class DccmFoundationsPistes {
  protected readonly pistes = PISTES_TEINTEES;
  protected readonly valeur = lecteurDeJetons();
}

@Component({
  selector: 'dccm-foundations-typographie',
  imports: [DccmFoundationsSection],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dccm-foundations-section
      titre="Typographie"
      description="Inter pour tout, JetBrains Mono (font-mono) pour les identifiants, hash, JSON et valeurs techniques."
    >
      <ul class="flex flex-col">
        @for (niveau of echelle; track niveau.jeton) {
          <li class="flex items-center gap-space-xl border-b border-surface-container-high py-space-sm">
            <div class="flex w-[220px] shrink-0 flex-col gap-0.5">
              <span class="text-label-regular font-semibold text-on-surface">{{ niveau.jeton }}</span>
              <span class="text-label-micro text-outline">{{ specification(niveau.jeton) }}</span>
            </div>
            <span class="text-on-surface" [class]="niveau.classe">{{ niveau.exemple }}</span>
          </li>
        }
        <li class="flex items-center gap-space-xl py-space-sm">
          <div class="flex w-[220px] shrink-0 flex-col gap-0.5">
            <span class="text-label-regular font-semibold text-on-surface">tabular-nums</span>
            <span class="text-label-micro text-outline">chiffres tabulaires (tnum)</span>
          </div>
          <span class="flex flex-col text-body-default text-on-surface">
            <span class="tabular-nums">1 111,11 € · 08:45</span>
            <span class="tabular-nums">8 888,88 € · 21:10</span>
          </span>
        </li>
      </ul>
    </dccm-foundations-section>
  `,
})
export class DccmFoundationsTypographie {
  protected readonly echelle = ECHELLE_TYPOGRAPHIQUE;
  private readonly valeur = lecteurDeJetons();

  protected specification(jeton: string): string {
    const police = jeton === 'code-mono' ? 'JetBrains Mono' : 'Inter';
    const approche = this.valeur(`text-${jeton}--letter-spacing`);
    return [
      police,
      `${this.valeur(`text-${jeton}`)} / ${this.valeur(`text-${jeton}--line-height`)}`,
      this.valeur(`text-${jeton}--font-weight`),
      approche && `ls ${approche}`,
    ]
      .filter(Boolean)
      .join(' · ');
  }
}

@Component({
  selector: 'dccm-foundations-espacements',
  imports: [DccmFoundationsSection],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dccm-foundations-section
      titre="Espacements"
      description="Incrément de 4 px. Utilitaires : p-space-md, gap-gutter, px-margin, px-margin-mobile…"
    >
      <ul class="flex flex-wrap items-end gap-gutter">
        @for (jeton of espacements; track jeton) {
          <li class="flex flex-col gap-1.5">
            <span
              class="border border-primary bg-primary-20"
              [style.width]="'var(--' + jeton + ')'"
              [style.height]="'var(--' + jeton + ')'"
            ></span>
            <span class="text-label-micro text-outline">{{ jeton }} · {{ valeur(jeton) }}</span>
          </li>
        }
      </ul>
    </dccm-foundations-section>
  `,
})
export class DccmFoundationsEspacements {
  protected readonly espacements = ESPACEMENTS;
  protected readonly valeur = lecteurDeJetons();
}

@Component({
  selector: 'dccm-foundations-rayons',
  imports: [DccmFoundationsSection],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dccm-foundations-section
      titre="Rayons"
      description="Cartes et modales 12, contrôles 8, tags 4 ; un élément imbriqué dans une carte prend 8."
    >
      <ul class="flex flex-wrap gap-gutter">
        @for (rayon of rayons; track rayon.jeton) {
          <li class="flex flex-col gap-1.5">
            <span
              class="h-12 w-[72px] border border-surface-container-highest bg-surface-container"
              [style.border-radius]="'var(--' + rayon.jeton + ')'"
            ></span>
            <span class="text-label-micro text-outline">
              {{ rayon.jeton }} · {{ valeur(rayon.jeton) }}
            </span>
            @if (rayon.usage) {
              <span class="text-label-micro text-outline">{{ rayon.usage }}</span>
            }
          </li>
        }
      </ul>
    </dccm-foundations-section>
  `,
})
export class DccmFoundationsRayons {
  protected readonly rayons = RAYONS;
  protected readonly valeur = lecteurDeJetons();
}

@Component({
  selector: 'dccm-foundations-icones',
  imports: [DccmFoundationsSection, NgIcon],
  providers: [provideIcons({ matCalendarMonthOutline })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dccm-foundations-section
      titre="Icônes — Material Symbols Outlined"
      description="Une seule bibliothèque, cinq tailles. L'icône prend le ton du texte de sa ligne."
    >
      <ul class="flex flex-wrap items-start gap-space-2xl">
        @for (taille of tailles; track taille.jeton) {
          <li class="flex max-w-40 flex-col gap-1.5">
            <ng-icon name="matCalendarMonthOutline" class="text-on-surface-variant" [class]="taille.classe" />
            <span class="text-label-micro text-outline">{{ taille.classe }} · {{ valeur(taille.jeton) }}</span>
            <span class="text-label-micro text-outline">{{ taille.usage }}</span>
          </li>
        }
      </ul>
    </dccm-foundations-section>
  `,
})
export class DccmFoundationsIcones {
  protected readonly tailles = TAILLES_ICONE;
  protected readonly valeur = lecteurDeJetons();
}

@Component({
  selector: 'dccm-foundations-elevation',
  imports: [DccmFoundationsSection],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dccm-foundations-section
      titre="Élévation & bordures"
      description="Pas d'ombre diffuse : empilement tonal et bordure 1 px. Seules les modales et les popovers portent une ombre (shadow-popover)."
    >
      <ul class="flex flex-wrap gap-gutter">
        @for (niveau of elevations; track niveau.nom) {
          <li class="flex flex-col gap-1.5">
            <span class="h-[88px] w-[200px] rounded-md" [class]="niveau.classe"></span>
            <span class="text-label-micro text-outline">{{ niveau.nom }}</span>
          </li>
        }
      </ul>
    </dccm-foundations-section>
  `,
})
export class DccmFoundationsElevation {
  protected readonly elevations = ELEVATIONS;
}
