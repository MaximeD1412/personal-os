import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matAddOutline,
  matArrowForwardOutline,
  matCheckOutline,
  matEditOutline,
  matMoreVertOutline,
  matSideNavigationOutline,
} from '@ng-icons/material-symbols/outline';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { type ButtonVariants, HlmButton } from './hlm-button';

// Les masters `Button/Primary`, `/Secondary`, `/Ghost`, `/Destructive`,
// `/Icon` et `/Link` de la planche `01 Actions`, et leurs galeries.

type Args = ButtonVariants & {
  loading: boolean;
  disabled: boolean;
  libelle: string;
  iconeDeTete: boolean;
  iconeDeFin: boolean;
};

const VARIANTES = ['primary', 'secondary', 'ghost', 'destructive'] as const;
const ETATS = ['default', 'hover', 'focus-visible', 'pressed', 'disabled', 'loading'] as const;

/** Une ligne de galerie : un libellé à gauche, des échantillons légendés. */
const ligne = (titre: string, echantillons: string) => `
  <div class="flex items-center gap-6">
    <span class="text-label-regular text-on-surface-variant w-30 shrink-0">${titre}</span>
    ${echantillons}
  </div>`;
const echantillon = (legende: string, contenu: string) => `
  <div class="flex flex-col gap-1.5">
    <div class="flex items-center gap-2">${contenu}</div>
    <span class="text-label-micro text-outline">${legende}</span>
  </div>`;

const meta: Meta<Args> = {
  title: 'Actions/Button',
  component: HlmButton,
  decorators: [
    moduleMetadata({
      imports: [HlmButton, NgIcon],
      providers: [
        provideIcons({
          matAddOutline,
          matArrowForwardOutline,
          matCheckOutline,
          matEditOutline,
          matMoreVertOutline,
          matSideNavigationOutline,
        }),
      ],
    }),
  ],
  parameters: { layout: 'padded' },
  args: {
    variant: 'primary',
    size: 'md',
    libelle: 'Nouvel événement',
    iconeDeTete: true,
    iconeDeFin: false,
    loading: false,
    disabled: false,
    fullWidth: false,
  },
  argTypes: {
    variant: { control: 'inline-radio', options: [...VARIANTES, 'link'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    libelle: { name: 'libellé', control: 'text' },
    iconeDeTete: { name: 'icône de tête', control: 'boolean' },
    iconeDeFin: { name: 'icône de fin', control: 'boolean' },
  },
};
export default meta;

type Story = StoryObj<Args>;

export const Bouton: Story = {
  render: (args) => ({
    props: args,
    template: `
      <button hlmBtn type="button" [variant]="variant" [size]="size" [loading]="loading" [disabled]="disabled" [fullWidth]="fullWidth">
        @if (iconeDeTete) { <ng-icon name="matAddOutline" /> }
        {{ libelle }}
        @if (iconeDeFin) { <ng-icon name="matArrowForwardOutline" /> }
      </button>`,
  }),
};

export const VariantesEtTailles: Story = {
  name: 'Variantes × tailles',
  parameters: { controls: { disable: true } },
  render: () => ({
    template: `<div class="flex flex-col gap-6">${VARIANTES.map((variante) =>
      ligne(
        variante,
        (['sm', 'md', 'lg'] as const)
          .map((taille) =>
            echantillon(
              taille,
              `<button hlmBtn type="button" variant="${variante}" size="${taille}"><ng-icon name="matAddOutline" />Nouvel événement</button>
               <button hlmBtn type="button" variant="${variante}" size="${taille}">Texte seul</button>`,
            ),
          )
          .join(''),
      ),
    ).join('')}</div>`,
  }),
};

/** Les états de la galerie, en taille md : survol, focus et pression sont forcés. */
export const Etats: Story = {
  name: 'États',
  parameters: {
    controls: { disable: true },
    pseudo: {
      hover: '[data-etat=hover]',
      focusVisible: '[data-etat=focus-visible]',
      active: '[data-etat=pressed]',
    },
  },
  render: () => ({
    template: `<div class="flex flex-col gap-6">${VARIANTES.map((variante) =>
      ligne(
        variante,
        ETATS.map((etat) =>
          echantillon(
            etat,
            `<button hlmBtn type="button" variant="${variante}" data-etat="${etat}"
                ${etat === 'disabled' ? 'disabled' : ''} ${etat === 'loading' ? 'loading' : ''}>
               <ng-icon name="matCheckOutline" />${etat === 'loading' ? 'Chargement…' : 'Enregistrer'}
             </button>`,
          ),
        ).join(''),
      ),
    ).join('')}</div>`,
  }),
};

/**
 * `Button/Icon` : 36 (`size="icon"`) ou 44 (`size="icon-lg"`), sans fond
 * (`ghost`) ou rempli (`secondary`). Toujours un `aria-label`.
 */
export const Icone: Story = {
  name: 'Icône',
  parameters: {
    controls: { disable: true },
    pseudo: {
      hover: '[data-etat=hover]',
      focusVisible: '[data-etat=focus-visible]',
      active: '[data-etat=pressed]',
    },
  },
  render: () => ({
    template: `<div class="flex flex-col gap-6">
      ${ligne(
        'Icon',
        [
          echantillon('ghost', `<button hlmBtn type="button" variant="ghost" size="icon" aria-label="Plus d'actions"><ng-icon name="matMoreVertOutline" /></button>`),
          echantillon('filled', `<button hlmBtn type="button" variant="secondary" size="icon" aria-label="Modifier"><ng-icon name="matEditOutline" /></button>`),
          echantillon('44', `<button hlmBtn type="button" variant="ghost" size="icon-lg" aria-label="Replier la navigation"><ng-icon name="matSideNavigationOutline" /></button>`),
        ].join(''),
      )}
      ${(['ghost', 'secondary'] as const)
        .map((variante) =>
          ligne(
            variante === 'ghost' ? 'Icon ghost' : 'Icon filled',
            ETATS.filter((etat) => etat !== 'loading')
              .map((etat) =>
                echantillon(
                  etat,
                  `<button hlmBtn type="button" variant="${variante}" size="icon" aria-label="Modifier" data-etat="${etat}" ${etat === 'disabled' ? 'disabled' : ''}><ng-icon name="matEditOutline" /></button>`,
                ),
              )
              .join(''),
          ),
        )
        .join('')}
    </div>`,
  }),
};

/** `Button/Link` : un texte `primary` 12/600, avec ou sans flèche de fin. */
export const Lien: Story = {
  parameters: {
    controls: { disable: true },
    pseudo: { hover: '[data-etat=hover]', focusVisible: '[data-etat=focus-visible]' },
  },
  render: () => ({
    template: ligne(
      'Link',
      [
        echantillon('icône', `<a hlmBtn variant="link" href="#">Voir tout<ng-icon name="matArrowForwardOutline" /></a>`),
        echantillon('sans icône', `<a hlmBtn variant="link" href="#">Ouvrir la fiche</a>`),
        echantillon('hover', `<a hlmBtn variant="link" href="#" data-etat="hover">Voir tout<ng-icon name="matArrowForwardOutline" /></a>`),
        echantillon('focus-visible', `<a hlmBtn variant="link" href="#" data-etat="focus-visible">Voir tout<ng-icon name="matArrowForwardOutline" /></a>`),
        echantillon('disabled', `<a hlmBtn variant="link" href="#" disabled>Voir tout<ng-icon name="matArrowForwardOutline" /></a>`),
      ].join(''),
    ),
  }),
};

export const PleineLargeur: Story = {
  name: 'Pleine largeur',
  parameters: { controls: { disable: true } },
  render: () => ({
    template: `<div class="w-80"><button hlmBtn type="button" size="lg" fullWidth><ng-icon name="matCheckOutline" />Enregistrer</button></div>`,
  }),
};
