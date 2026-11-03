import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matKeyboardArrowDownOutline,
  matSearchOutline,
  matTerminalOutline,
} from '@ng-icons/material-symbols/outline';
import { HlmKbd } from '@personal-os/ui/kbd';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import type { InputSize } from './hlm-input-box';
import { HlmInput } from './hlm-input';
import { HlmInputGroup } from './hlm-input-group';

// Le master `Input` de la planche `02 Forms` et sa galerie d'états.

type Args = {
  placeholder: string;
  size: InputSize;
  disabled: boolean;
  forceInvalid: boolean;
  iconeDeTete: boolean;
  raccourci: string;
  iconeDeFin: boolean;
};

const echantillon = (legende: string, contenu: string) => `
  <div class="flex w-60 flex-col gap-1.5">
    ${contenu}
    <span class="text-label-micro text-outline">${legende}</span>
  </div>`;

const meta: Meta<Args> = {
  title: 'Forms/Input',
  component: HlmInput,
  decorators: [
    moduleMetadata({
      imports: [HlmInput, HlmInputGroup, HlmKbd, NgIcon],
      providers: [
        provideIcons({
          matKeyboardArrowDownOutline,
          matSearchOutline,
          matTerminalOutline,
        }),
      ],
    }),
  ],
  args: {
    placeholder: 'Rechercher…',
    size: 'md',
    disabled: false,
    forceInvalid: false,
    iconeDeTete: true,
    raccourci: '',
    iconeDeFin: false,
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['md', 'lg'] },
    forceInvalid: { name: 'en erreur', control: 'boolean' },
    iconeDeTete: { name: 'icône de tête', control: 'boolean' },
    raccourci: { control: 'text' },
    iconeDeFin: { name: 'icône de fin', control: 'boolean' },
  },
};
export default meta;

type Story = StoryObj<Args>;

export const Champ: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div class="w-80">
        <div hlmInputGroup [size]="size">
          @if (iconeDeTete) { <ng-icon name="matSearchOutline" /> }
          <input hlmInput aria-label="Recherche" [placeholder]="placeholder" [disabled]="disabled" [forceInvalid]="forceInvalid" />
          @if (raccourci) { <kbd hlmKbd>{{ raccourci }}</kbd> }
          @if (iconeDeFin) { <ng-icon name="matKeyboardArrowDownOutline" /> }
        </div>
      </div>`,
  }),
};

/** Les états de la galerie : focus et survol sont forcés. */
export const Etats: Story = {
  name: 'États',
  parameters: {
    controls: { disable: true },
    pseudo: {
      hover: '[data-etat=hover]',
      focusVisible: '[data-etat=focus] input',
      focusWithin: '[data-etat=focus]',
    },
  },
  render: () => ({
    template: `
      <div class="flex flex-wrap items-start gap-6">
        ${echantillon('default', `<div hlmInputGroup><ng-icon name="matSearchOutline" /><input hlmInput aria-label="Recherche" placeholder="Rechercher…" /></div>`)}
        ${echantillon('hover', `<div hlmInputGroup data-etat="hover"><ng-icon name="matSearchOutline" /><input hlmInput aria-label="Recherche" placeholder="Rechercher…" /></div>`)}
        ${echantillon('focus', `<div hlmInputGroup data-etat="focus"><ng-icon name="matSearchOutline" /><input hlmInput aria-label="Recette" value="Poulet basq" /></div>`)}
        ${echantillon('filled', `<div hlmInputGroup><ng-icon name="matSearchOutline" /><input hlmInput aria-label="Recette" value="Poulet basquaise" /></div>`)}
        ${echantillon('error', `<div hlmInputGroup><ng-icon name="matSearchOutline" /><input hlmInput aria-label="Quantité" value="Quantité invalide" forceInvalid /></div>`)}
        ${echantillon('disabled', `<div hlmInputGroup><ng-icon name="matSearchOutline" /><input hlmInput aria-label="Recherche" placeholder="Rechercher…" disabled /></div>`)}
      </div>`,
  }),
};

/** Les parties du master : icône de tête, raccourci, icône de fin ; ou le champ seul. */
export const Parties: Story = {
  parameters: { controls: { disable: true } },
  render: () => ({
    template: `
      <div class="flex flex-wrap items-start gap-6">
        ${echantillon('champ seul', `<input hlmInput aria-label="Titre" placeholder="Saisir un titre…" />`)}
        <div class="flex w-80 flex-col gap-1.5">
          <div hlmInputGroup><ng-icon name="matTerminalOutline" /><input hlmInput aria-label="Commande" placeholder="Que veux-tu faire ?" /><kbd hlmKbd>⌘K</kbd></div>
          <span class="text-label-micro text-outline">command (⌘K)</span>
        </div>
        ${echantillon('icône de fin', `<div hlmInputGroup><input hlmInput aria-label="Catégorie" placeholder="Catégorie" /><ng-icon name="matKeyboardArrowDownOutline" /></div>`)}
      </div>`,
  }),
};

export const Tailles: Story = {
  parameters: { controls: { disable: true } },
  render: () => ({
    template: `
      <div class="flex flex-wrap items-start gap-6">
        ${echantillon('md · 36', `<div hlmInputGroup size="md"><ng-icon name="matSearchOutline" /><input hlmInput aria-label="Recherche" placeholder="Rechercher…" /></div>`)}
        ${echantillon('lg · 40', `<div hlmInputGroup size="lg"><ng-icon name="matSearchOutline" /><input hlmInput aria-label="Recherche" placeholder="Rechercher…" /></div>`)}
        ${echantillon('champ seul md', `<input hlmInput size="md" aria-label="Titre" placeholder="Saisir un titre…" />`)}
        ${echantillon('champ seul lg', `<input hlmInput size="lg" aria-label="Titre" placeholder="Saisir un titre…" />`)}
      </div>`,
  }),
};
