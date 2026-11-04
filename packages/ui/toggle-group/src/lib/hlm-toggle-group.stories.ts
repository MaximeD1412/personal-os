import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matCalendarMonthOutline,
  matCalendarViewWeekOutline,
  matFormatListBulletedOutline,
} from '@ng-icons/material-symbols/outline';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { HlmToggleGroupImports } from '../index';

// Les masters `SegmentedControl`, `Tab/Active` et `Tab/Inactive` de la
// planche `02 Forms` : un choix unique, toujours un segment actif.

type Args = { value: string; size: 'sm' | 'md'; icones: boolean; disabled: boolean };

const segments = (icones: boolean | string) => {
  const icone = (nom: string) =>
    icones === true
      ? `<ng-icon name="${nom}" />`
      : icones
        ? `@if (${icones}) { <ng-icon name="${nom}" /> }`
        : '';
  return `
    <button hlmToggleGroupItem value="semaine">${icone('matCalendarViewWeekOutline')}Semaine</button>
    <button hlmToggleGroupItem value="mois">${icone('matCalendarMonthOutline')}Mois</button>
    <button hlmToggleGroupItem value="liste">${icone('matFormatListBulletedOutline')}Liste</button>`;
};

const echantillon = (legende: string, contenu: string) => `
  <div class="flex flex-col items-start gap-1.5">
    ${contenu}
    <span class="text-label-micro text-outline">${legende}</span>
  </div>`;

const meta: Meta<Args> = {
  title: 'Forms/SegmentedControl',
  decorators: [
    moduleMetadata({
      imports: [HlmToggleGroupImports, NgIcon],
      providers: [
        provideIcons({
          matCalendarMonthOutline,
          matCalendarViewWeekOutline,
          matFormatListBulletedOutline,
        }),
      ],
    }),
  ],
  args: { value: 'semaine', size: 'sm', icones: false, disabled: false },
  argTypes: {
    value: { control: 'inline-radio', options: ['semaine', 'mois', 'liste'] },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
    icones: { name: 'icônes', control: 'boolean' },
  },
};
export default meta;

type Story = StoryObj<Args>;

export const Segments: Story = {
  render: (args) => ({
    props: args,
    template: `
      <hlm-toggle-group aria-label="Période" [(value)]="value" [size]="size" [disabled]="disabled">
        ${segments('icones')}
      </hlm-toggle-group>`,
  }),
};

export const Galerie: Story = {
  parameters: {
    controls: { disable: true },
    pseudo: {
      hover: '[data-etat=hover] button[value=mois]',
      focusVisible: '[data-etat=focus] button[value=semaine]',
      active: '[data-etat=pressed] button[value=mois]',
    },
  },
  render: () => ({
    template: `
      <div class="flex flex-wrap items-start gap-6">
        ${echantillon('segmented', `<hlm-toggle-group aria-label="Période" value="semaine">${segments(false)}</hlm-toggle-group>`)}
        ${echantillon('12px · fond low · r12', `<hlm-toggle-group aria-label="Période" value="semaine" size="md">${segments(false)}</hlm-toggle-group>`)}
        ${echantillon('avec icônes', `<hlm-toggle-group aria-label="Période" value="semaine">${segments(true)}</hlm-toggle-group>`)}
        ${echantillon('hover (Mois)', `<hlm-toggle-group aria-label="Période" value="semaine" data-etat="hover">${segments(false)}</hlm-toggle-group>`)}
        ${echantillon('focus-visible', `<hlm-toggle-group aria-label="Période" value="semaine" data-etat="focus">${segments(false)}</hlm-toggle-group>`)}
        ${echantillon('pressed (Mois)', `<hlm-toggle-group aria-label="Période" value="semaine" data-etat="pressed">${segments(false)}</hlm-toggle-group>`)}
        ${echantillon('disabled', `<hlm-toggle-group aria-label="Période" value="semaine" disabled>${segments(false)}</hlm-toggle-group>`)}
      </div>`,
  }),
};
